import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="govuk-template">
      <Head>
        <meta name="description" content="National Rail live departure boards" />
        <meta name="application-name" content="Train Times" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Train Times" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1d70b8" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="stylesheet" href="/govuk-frontend.min.css" />
      </Head>
      <body className="govuk-template__body">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
