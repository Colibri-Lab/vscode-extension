<h1 align="center">
Colibri UI Extension
</h1>

The application was created to help work with the Colibri engine and Colibri UI Bundler.

# Before start

First of all, you need to register at https://gitlab.colibrilab.pro/users/sign_up and get an access key

# Create a project

composer create-project colibri/blank-project:dev-master ./«path to application»/ --repository="{\"url\": \"https://gitlab.repeatme.online/api/v4 /group/7/-/packages/composer/packages.json\", \"type\": \"composer\"}" --stability=dev --remove-vcs

# Adding modules

composer require <module name> --repository="{\"url\": \"https://git:V5P3EvURpCR4yS_aecbh@gitlab.repeatme.online/"module path"\", \"type\": \"vcs \"}"

# Setting up Nginx

[Documentation](https://gitlab.repeatme.online/colibrilab/blank)

# Colibri-UI Extension

## Usage

Functions to use within modules

- Ctrl+P -> Create Colibri.UI Component

  1. Enter the path to the namespace (within .Bundle folder)(within .Bundle folder)
  2. Enter the Component name with namespace
  3. Enter the Parent component name with namespace

- Ctrl+P -> Create Colibri.UI Namespace

  1. Enter the path to namespace (within .Bundle folder)
  2. Enter the namespace name


# Open the js/html/php files 

Codelence works in files like javascript/php/html (template for the component), all keys of multilingual texts will be highlighted and a tooltip with translations will appear on hover.

CodeLence for each of the keys displays the translation function as a list of languages

```
РУССКИЙ ENGLISH ՀԱՅԵՐԵՆ
<Text value="#{modulename-language-key}" />
```

# Code completion, references and goto functions in HTML templates

# Open the component html template

Component code completion

Component attributes code completion

# Creating an Colibri Blank project

- Ctrl+P -> Create the blank Colibri project

# Download existing modules

- Ctrl+P -> Download module

# Or create your own

- Ctrl+P -> Download module -> Create new

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the MIT License.