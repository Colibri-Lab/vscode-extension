<?php
use Colibri\App;

if (App::$domainKey === '{module-name}') {
    ?>
    <script>
        App.InitializeApplication(
            '{module-name}',
            1,
            Colibri.Web.Router.RouteOnHistory,
            Colibri.IO.Request.RequestEncodeTypeEncrypted,
            true,
            true,
            location.protocol + '//' + location.host,
            'en-US',
            'en-US',
            {
                code: 'USD',
                symbol: '$'
            }
        );
    </script>
<?php
}
?>