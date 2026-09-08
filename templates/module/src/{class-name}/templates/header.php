<?php
use Colibri\App;

if (App::$domainKey === '{module-name}') {
    ?>
    <title>{class-name}</title>
    <meta name="google" content="notranslate" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
<?php
}
?>