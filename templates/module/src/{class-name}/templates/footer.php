<?php
use Colibri\App;

if (App::$domainKey === '{module-name}') {
    ?>
    <script>
        App.InitializeApplication(
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