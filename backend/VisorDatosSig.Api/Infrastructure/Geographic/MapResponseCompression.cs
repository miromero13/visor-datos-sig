using Microsoft.AspNetCore.ResponseCompression;

namespace VisorDatosSig.Api;

public static class MapResponseCompression
{
    public static IServiceCollection AddMapResponseCompression(this IServiceCollection services)
    {
        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ["application/json"];
        });
        services.Configure<BrotliCompressionProviderOptions>(options => options.Level = System.IO.Compression.CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(options => options.Level = System.IO.Compression.CompressionLevel.Fastest);
        return services;
    }

    public static IApplicationBuilder UseMapResponseCompression(this IApplicationBuilder app)
    {
        app.UseWhen(context => context.Request.Path.StartsWithSegments("/api/layers"), branch => branch.UseResponseCompression());
        return app;
    }
}
