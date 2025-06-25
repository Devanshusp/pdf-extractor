import { GlobalWorkerOptions } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

// Set up the worker
GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
).toString(); 