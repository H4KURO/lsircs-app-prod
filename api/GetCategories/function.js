    {
      "bindings": [
        {
          "authLevel": "anonymous",
          "type": "httpTrigger",
          "direction": "in",
          "name": "req",
          "methods": [
            "get"
          ],
          "route": "GetCategories"
        },
        {
          "type": "http",
          "direction": "out",
          "name": "res"
        }
      ]
    }