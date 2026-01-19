import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://KAIYU.vn";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin/", "/dashboard/", "/api/", "/learn/", "/vocab/", "/review/", "/settings/", "/profile/"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
