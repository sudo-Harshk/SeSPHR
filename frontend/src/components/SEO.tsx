import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    name?: string;
    type?: string;
    keywords?: string;
}

export default function SEO({ title, description, name, type, keywords }: SEOProps) {
    return (
        <Helmet>
            {/* Standard Metadata tags */}
            <title>{title}</title>
            <meta name='description' content={description} />
            {keywords && <meta name="keywords" content={keywords} />}

            {/* Facebook tags */}
            <meta property="og:type" content={type || 'website'} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />

            {/* Twitter tags */}
            <meta name="twitter:creator" content={name || "SeSPHR"} />
            <meta name="twitter:card" content={type || 'summary'} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
        </Helmet>
    );
}
