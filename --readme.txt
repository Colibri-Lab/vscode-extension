bhqpumirci4quulpz27zdvk6sorc2lmocfllm2no3nebadcjcoca

# compile
```
vsce package
```

# install
```
code --install-extension myextension.vsix
```


activationEvents
    "onLanguage:html",
    "onLanguage:javascript",
    "onLanguage:php",
    "onCommand:colibri-ui.create-component",
    "onCommand:colibri-ui.create-namespace",
    "onCommand:colibri-ui.migrate",
    "onCommand:colibri-ui.models-generate"






commands
      {
        "command": "colibri-ui.translate-byopenai",
        "title": "%extension.translate-byopenai.title%"
      },
      {
        "command": "colibri-ui.translate-bycopilot",
        "title": "%extension.translate-bycopilot.title%"
      },

properties 
        "colibrilab.openai-api-key": {
            "type": "string",
            "order": 7,
            "description": "%extension.settings-openai-api-key.description%",
            "default": "",
            "additionalProperties": false
          },
          "colibrilab.github-api-key": {
            "type": "string",
            "order": 8,
            "description": "%extension.settings-github-api-key.description%",
            "default": "",
            "additionalProperties": false
          }
dependencies
    "@copilot-extensions/preview-sdk": "^5.0.1",
    "openai": "^5.12.2",
