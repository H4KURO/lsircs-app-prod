    module.exports = async function (context, req) {
      context.log('HealthCheck API was called.');
      context.res = {
        // status: 200, /* Defaults to 200 */
        body: "API is alive!"
      };
    };
    ```

3.  次に、この新しいAPIの「通行許可証」を発行します。`staticwebapp.config.json`を開き、`routes`配列の**一番上**に、以下のブロックを追加してください。

    ```json
    {
      "route": "/api/HealthCheck",
      "allowedRoles": [ "anonymous" ]
    },
    
