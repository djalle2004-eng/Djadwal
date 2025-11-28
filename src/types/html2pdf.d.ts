/**
 * Type definitions for html2pdf.js
 */

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      scrollY?: number;
      scrollX?: number;
      [key: string]: any;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: 'portrait' | 'landscape';
      compress?: boolean;
      [key: string]: any;
    };
    pagebreak?: {
      mode?: string | string[];
      [key: string]: any;
    };
  }

  interface Html2Pdf {
    set(opt: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement | string): Html2Pdf;
    save(): Promise<void>;
    outputPdf(type?: string): Promise<any>;
    output(type?: string, options?: any): Promise<any>;
    then(callback: (pdf: any) => void): Promise<any>;
    toPdf(): Promise<any>;
    get(key: string): any;
    catch(callback: (error: Error) => void): Promise<any>;
  }

  function html2pdf(): Html2Pdf;
  function html2pdf(element: HTMLElement | string, opt?: Html2PdfOptions): Html2Pdf;

  export default html2pdf;
}
