#if __has_include(<node_api.h>)
#include <node_api.h>
#elif __has_include(<node/node_api.h>)
#include <node/node_api.h>
#endif

#if __has_include(<napi.h>)
#include <napi.h>
#elif __has_include("napi.h")
#include "napi.h"
#elif __has_include(<node-addon-api/napi.h>)
#include <node-addon-api/napi.h>
#else
#error "Cannot find napi.h. Add node-addon-api and Node headers to includePath."
#endif

#include <windows.h>
#include <wincred.h>
#include <ncrypt.h>
#include <lmcons.h>
#include <vector>
#include <string>

// --- Windows Hello (WinRT) Includes ---
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Security.Credentials.UI.h>
#include <userconsentverifierinterop.h>

#pragma comment(lib, "credui.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "ncrypt.lib")
#pragma comment(lib, "windowsapp.lib")

// --- 1. Helper Function Moved Up ---
SECURITY_STATUS GetTpmKey(NCRYPT_KEY_HANDLE &hKey)
{
    NCRYPT_PROV_HANDLE hProv = 0;
    SECURITY_STATUS status = NCryptOpenStorageProvider(&hProv, MS_PLATFORM_KEY_STORAGE_PROVIDER, 0);
    if (status != ERROR_SUCCESS)
    {
        status = NCryptOpenStorageProvider(&hProv, MS_KEY_STORAGE_PROVIDER, 0);
    }
    if (status != ERROR_SUCCESS)
        return status;

    status = NCryptOpenKey(hProv, &hKey, L"BedrockVaultTpmKey", 0, 0);
    if (status == NTE_BAD_KEYSET)
    {
        status = NCryptCreatePersistedKey(hProv, &hKey, BCRYPT_RSA_ALGORITHM, L"BedrockVaultTpmKey", 0, 0);
        if (status == ERROR_SUCCESS)
        {
            status = NCryptFinalizeKey(hKey, 0);
            if (status != ERROR_SUCCESS)
            {
                NCryptFreeObject(hKey);
                hKey = 0;
            }
        }
    }
    NCryptFreeObject(hProv);
    return status;
}

// --- 2. Credential Worker ---
class CredentialWorker : public Napi::AsyncWorker
{
public:
    CredentialWorker(Napi::Env &env, Napi::Promise::Deferred &deferred, HWND parentHwnd)
        : Napi::AsyncWorker(env), deferred(deferred), parentHwnd(parentHwnd) {}
    ~CredentialWorker() {}

    void Execute() override
    {
        CREDUI_INFOW credui = {0};
        credui.cbSize = sizeof(credui);

        credui.hwndParent = NULL;

        credui.pszMessageText = L"Please enter chunk password.";
        credui.pszCaptionText = L"Bedrock Vault";

        ULONG authPackage = 0;
        LPVOID outAuthBuffer = NULL;
        ULONG outAuthBufferSize = 0;
        BOOL save = FALSE;

        wchar_t targetName[UNLEN + 1];
        DWORD targetNameLen = UNLEN + 1;

        if (!GetUserNameW(targetName, &targetNameLen))
        {
            wcscpy_s(targetName, UNLEN + 1, L"UnknownUser");
        }

        wchar_t emptyPassword[] = L"";

        DWORD inAuthBufferSize = 0;
        CredPackAuthenticationBufferW(0, targetName, emptyPassword, NULL, &inAuthBufferSize);

        std::vector<BYTE> inAuthBuffer(inAuthBufferSize);
        CredPackAuthenticationBufferW(0, targetName, emptyPassword, inAuthBuffer.data(), &inAuthBufferSize);

        DWORD flags = CREDUIWIN_GENERIC | CREDUIWIN_IN_CRED_ONLY;

        DWORD result = CredUIPromptForWindowsCredentialsW(
            &credui,
            0,
            &authPackage,
            inAuthBuffer.data(),
            inAuthBufferSize,
            &outAuthBuffer,
            &outAuthBufferSize,
            &save,
            flags);

        if (result == ERROR_SUCCESS)
        {
            DWORD userLen = CREDUI_MAX_USERNAME_LENGTH + 1;
            DWORD domainLen = CREDUI_MAX_DOMAIN_TARGET_LENGTH + 1;
            DWORD passLen = CREDUI_MAX_PASSWORD_LENGTH + 1;

            std::vector<wchar_t> user(userLen);
            std::vector<wchar_t> domain(domainLen);
            std::vector<wchar_t> pass(passLen);

            CredUnPackAuthenticationBufferW(
                CREDUI_FLAGS_GENERIC_CREDENTIALS,
                outAuthBuffer,
                outAuthBufferSize,
                user.data(), &userLen,
                domain.data(), &domainLen,
                pass.data(), &passLen);

            int utf8Len = WideCharToMultiByte(CP_UTF8, 0, pass.data(), -1, NULL, 0, NULL, NULL);
            if (utf8Len > 0)
            {
                passwordData.resize(utf8Len);
                WideCharToMultiByte(CP_UTF8, 0, pass.data(), -1, passwordData.data(), utf8Len, NULL, NULL);
            }

            SecureZeroMemory(pass.data(), pass.size() * sizeof(wchar_t));
            SecureZeroMemory(user.data(), user.size() * sizeof(wchar_t));
            SecureZeroMemory(outAuthBuffer, outAuthBufferSize);
            CoTaskMemFree(outAuthBuffer);
        }
        else if (result == ERROR_CANCELLED)
        {
            SetError("USER_CANCELLED");
        }
        else
        {
            SetError("PROMPT_FAILED");
        }
    }

    void OnOK() override
    {
        Napi::Env env = Env();

        // FIX: Prevent Integer Underflow Crash
        if (passwordData.empty())
        {
            deferred.Resolve(Napi::Buffer<char>::New(env, 0));
            return;
        }

        Napi::Buffer<char> jsBuffer = Napi::Buffer<char>::Copy(env, passwordData.data(), passwordData.size() - 1);

        // Security: Zero memory before freeing C++ side
        SecureZeroMemory(passwordData.data(), passwordData.size());

        deferred.Resolve(jsBuffer);
    }

    void OnError(const Napi::Error &e) override
    {
        deferred.Reject(e.Value());
    }

private:
    Napi::Promise::Deferred deferred;
    std::vector<char> passwordData;
    HWND parentHwnd;
};

// --- 3. Async TPM Worker ---
// FIX: Moved TPM operations to a background thread to prevent UI freezing
class TpmCryptoWorker : public Napi::AsyncWorker
{
public:
    TpmCryptoWorker(Napi::Env &env, Napi::Promise::Deferred &deferred, const std::vector<char> &inputData, bool isEncrypt)
        : Napi::AsyncWorker(env), deferred(deferred), inputData(inputData), isEncrypt(isEncrypt) {}

    void Execute() override
    {
        NCRYPT_KEY_HANDLE hKey = 0;
        SECURITY_STATUS status = GetTpmKey(hKey);
        if (status != ERROR_SUCCESS)
        {
            SetError("Failed to initialize TPM key");
            return;
        }

        DWORD cbResult = 0;

        // Size query
        if (isEncrypt)
        {
            status = NCryptEncrypt(hKey, reinterpret_cast<PBYTE>(const_cast<char *>(inputData.data())), inputData.size(), NULL, NULL, 0, &cbResult, NCRYPT_PAD_PKCS1_FLAG);
        }
        else
        {
            status = NCryptDecrypt(hKey, reinterpret_cast<PBYTE>(const_cast<char *>(inputData.data())), inputData.size(), NULL, NULL, 0, &cbResult, NCRYPT_PAD_PKCS1_FLAG);
        }

        if (status != ERROR_SUCCESS)
        {
            NCryptFreeObject(hKey);
            SetError(isEncrypt ? "TPM NCryptEncrypt size query failed" : "TPM NCryptDecrypt size query failed");
            return;
        }

        resultData.resize(cbResult);

        // Actual operation
        if (isEncrypt)
        {
            status = NCryptEncrypt(hKey, reinterpret_cast<PBYTE>(const_cast<char *>(inputData.data())), inputData.size(), NULL, resultData.data(), resultData.size(), &cbResult, NCRYPT_PAD_PKCS1_FLAG);
        }
        else
        {
            status = NCryptDecrypt(hKey, reinterpret_cast<PBYTE>(const_cast<char *>(inputData.data())), inputData.size(), NULL, resultData.data(), resultData.size(), &cbResult, NCRYPT_PAD_PKCS1_FLAG);
        }

        NCryptFreeObject(hKey);

        if (status != ERROR_SUCCESS)
        {
            SetError(isEncrypt ? "TPM NCryptEncrypt failed" : "TPM NCryptDecrypt failed");
            return;
        }

        resultData.resize(cbResult);
    }

    void OnOK() override
    {
        Napi::Env env = Env();
        Napi::Buffer<char> jsBuffer = Napi::Buffer<char>::Copy(env, reinterpret_cast<char *>(resultData.data()), resultData.size());

        if (!isEncrypt)
        {
            SecureZeroMemory(resultData.data(), resultData.size());
        }

        deferred.Resolve(jsBuffer);
    }

    void OnError(const Napi::Error &e) override
    {
        deferred.Reject(e.Value());
    }

private:
    Napi::Promise::Deferred deferred;
    std::vector<char> inputData;
    std::vector<BYTE> resultData;
    bool isEncrypt;
};

class HelloAuthWorker : public Napi::AsyncWorker
{
public:
    HelloAuthWorker(Napi::Env &env, Napi::Promise::Deferred &deferred)
        : Napi::AsyncWorker(env), deferred(deferred), success(false) {}

    void Execute() override
    {
        try { winrt::init_apartment(); } catch (...) {}

        try
        {
            auto factory = winrt::get_activation_factory<
                winrt::Windows::Security::Credentials::UI::UserConsentVerifier,
                IUserConsentVerifierInterop>();

            HWND hwnd = GetForegroundWindow();
            if (!hwnd) hwnd = GetConsoleWindow();
            if (!hwnd) hwnd = GetDesktopWindow(); 

            winrt::hstring message = L"Please verify your identity to unlock Bedrock Vault.";
            winrt::Windows::Foundation::IAsyncOperation<winrt::Windows::Security::Credentials::UI::UserConsentVerificationResult> asyncOp{ nullptr };

            winrt::check_hresult(factory->RequestVerificationForWindowAsync(
                hwnd,
                (HSTRING)winrt::get_abi(message),
                winrt::guid_of<winrt::Windows::Foundation::IAsyncOperation<winrt::Windows::Security::Credentials::UI::UserConsentVerificationResult>>(),
                winrt::put_abi(asyncOp)
            ));

            auto result = asyncOp.get();
            success = (result == winrt::Windows::Security::Credentials::UI::UserConsentVerificationResult::Verified);
        }
        catch (const winrt::hresult_error& e)
        {
            SetError(winrt::to_string(e.message()));
        }
        catch (const std::exception& e)
        {
            SetError(e.what());
        }
    }

    void OnOK() override
    {
        Napi::Env env = Env();
        deferred.Resolve(Napi::Boolean::New(env, success));
    }

    void OnError(const Napi::Error &e) override
    {
        deferred.Reject(e.Value());
    }

private:
    Napi::Promise::Deferred deferred;
    bool success;
};

// --- JS Bindings ---

Napi::Value PromptPassword(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    HWND parentHwnd = NULL;
    if (info.Length() > 0 && info[0].IsBuffer())
    {
        Napi::Buffer<void *> buf = info[0].As<Napi::Buffer<void *>>();
        if (buf.Length() >= sizeof(HWND))
        {
            parentHwnd = *reinterpret_cast<HWND *>(buf.Data());
        }
    }

    CredentialWorker *worker = new CredentialWorker(env, deferred, parentHwnd);
    worker->Queue();

    return deferred.Promise();
}

Napi::Value IsTpmAvailable(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    NCRYPT_PROV_HANDLE hProv = 0;
    SECURITY_STATUS status = NCryptOpenStorageProvider(&hProv, MS_PLATFORM_KEY_STORAGE_PROVIDER, 0);
    if (status == ERROR_SUCCESS)
    {
        NCryptFreeObject(hProv);
        return Napi::Boolean::New(env, true);
    }
    return Napi::Boolean::New(env, false);
}

Napi::Value IsSoftwareKspAvailable(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    NCRYPT_PROV_HANDLE hProv = 0;
    SECURITY_STATUS status = NCryptOpenStorageProvider(&hProv, MS_KEY_STORAGE_PROVIDER, 0);
    if (status == ERROR_SUCCESS)
    {
        NCryptFreeObject(hProv);
        return Napi::Boolean::New(env, true);
    }
    return Napi::Boolean::New(env, false);
}

Napi::Value TpmEncrypt(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsBuffer())
    {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<char> input = info[0].As<Napi::Buffer<char>>();
    std::vector<char> inputData(input.Data(), input.Data() + input.Length());

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    TpmCryptoWorker *worker = new TpmCryptoWorker(env, deferred, inputData, true);
    worker->Queue();

    return deferred.Promise();
}

Napi::Value TpmDecrypt(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsBuffer())
    {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<char> input = info[0].As<Napi::Buffer<char>>();
    std::vector<char> inputData(input.Data(), input.Data() + input.Length());

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    TpmCryptoWorker *worker = new TpmCryptoWorker(env, deferred, inputData, false);
    worker->Queue();

    return deferred.Promise();
}

Napi::Value AuthenticateOsUser(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    HelloAuthWorker *worker = new HelloAuthWorker(env, deferred);
    worker->Queue();

    return deferred.Promise();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "promptPassword"), Napi::Function::New(env, PromptPassword));
    exports.Set(Napi::String::New(env, "tpmEncrypt"), Napi::Function::New(env, TpmEncrypt));
    exports.Set(Napi::String::New(env, "tpmDecrypt"), Napi::Function::New(env, TpmDecrypt));
    exports.Set(Napi::String::New(env, "isTpmAvailable"), Napi::Function::New(env, IsTpmAvailable));
    exports.Set(Napi::String::New(env, "isSoftwareKspAvailable"), Napi::Function::New(env, IsSoftwareKspAvailable));
    exports.Set(Napi::String::New(env, "authenticateOsUser"), Napi::Function::New(env, AuthenticateOsUser));
    return exports;
}

NODE_API_MODULE(native_prompt, Init)