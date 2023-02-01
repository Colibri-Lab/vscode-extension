<?php
use Colibri\App;

if (App::$domainKey === '{module-name}') {
    ?>
    <script>
        App.InitializeApplication(
            '{module-name}',
            Colibri.Web.Router.RouteOnHistory,
            Colibri.IO.Request.RequestEncodeTypeEncrypted,
            true,
            false,
            location.protocol + '//' + location.host
        );
    </script>
<?php
}
?>