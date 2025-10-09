window.onload = function() {
    // If the openapi_url query parameter is present, use that value as the URL for the OpenAPI definition
    const urlParams = new URLSearchParams(window.location.search);
    const openapiUrl = urlParams.get('openapi_url');
    if (openapiUrl) {
        url = openapiUrl;
    } else {
        url = "openapi.yaml";
    }

    window.ui = SwaggerUIBundle({
        url: url,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
        ],
        plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
    });

};
