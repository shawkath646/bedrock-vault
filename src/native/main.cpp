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
#include <lmcons.h>
#include <vector>
#include <string>

#pragma comment(lib, "credui.lib")
#pragma comment(lib, "advapi32.lib")

class CredentialWorker : public Napi::AsyncWorker
{
public:
    CredentialWorker(Napi::Env &env, Napi::Promise::Deferred &deferred)
        : Napi::AsyncWorker(env), deferred(deferred) {}
    ~CredentialWorker() {}

    void Execute() override
    {
        CREDUI_INFOW credui = {0};
        credui.cbSize = sizeof(credui);
        credui.hwndParent = NULL;
        credui.pszMessageText = L"Please enter chunk password.";
        credui.pszCaptionText = L"Anonymous File Storage";

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
        Napi::Buffer<char> jsBuffer = Napi::Buffer<char>::Copy(env, passwordData.data(), passwordData.size() - 1);

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
};

Napi::Value PromptPassword(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    CredentialWorker *worker = new CredentialWorker(env, deferred);
    worker->Queue();

    return deferred.Promise();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "promptPassword"), Napi::Function::New(env, PromptPassword));
    return exports;
}

NODE_API_MODULE(native_prompt, Init)