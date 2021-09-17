import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

import { rehydrate, renderStatic } from '@navch-ui/styles';

// Rehydrate to ensure that the client doesn't duplicate styles
if (typeof window !== undefined) {
  rehydrate();
}

export interface DocumentProps {
  styleHTML: string;
  scriptHTML: string;
}

export default class RootDocument extends Document<DocumentProps> {
  static async getInitialProps({ renderPage }: DocumentContext) {
    const { html, ...rest } = renderStatic(() => renderPage());
    return { ...html, ...rest };
  }

  render() {
    const { scriptHTML, styleHTML } = this.props;

    return (
      <Html>
        <Head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css"
          />
          <style data-aphrodite dangerouslySetInnerHTML={{ __html: styleHTML }} />
        </Head>
        <body>
          <Main />
          <NextScript />
          <script dangerouslySetInnerHTML={{ __html: scriptHTML }} />
        </body>
      </Html>
    );
  }
}
