{
  "targets": [
    {
      "target_name": "native_prompt",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ "./src/native/main.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require(require('node:path').resolve(process.cwd(), './node_modules/node-addon-api')).include\")"
      ],
      "dependencies": [
        "<!(node -p \"require(require('node:path').resolve(process.cwd(), './node_modules/node-addon-api')).gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [ "-lcredui.lib" ]
        }]
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17", "/await" ]
        }
      }
    }
  ]
} # type: ignore