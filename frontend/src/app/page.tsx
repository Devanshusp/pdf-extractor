// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CanvasLayer, HighlightLayer, Page, Pages, Root, TextLayer, usePdfJump, usePdf, Search, useSearch, calculateHighlightRects, SearchResult } from "@anaralabs/lector";
import "@/lib/setup";
import { useDebounce } from "use-debounce";

interface TextChunk {
  page_number: number;
  text: string;
  px_left: number;
  px_bottom: number;
  width: number;
  height: number;
}

interface HighlightRect {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Highlight {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface HighlightItem {
  id: number;
  title: string;
  text: string;
  highlights: Highlight[];
}

const DEFAULT_PDF_URL = 'https://d6ziqu2pgbz50.cloudfront.net/content/d62bb70c7285458685917e555ad89819.pdf';
const SEARCH_DEBOUNCE_MS = 500;
const INITIAL_SEARCH_LIMIT = 10;
const SEARCH_INCREMENT = 10;

interface ResultItemProps {
  result: SearchResult;
  originalSearchText: string;
}

const ResultItem = ({ result, originalSearchText }: ResultItemProps) => {
  const { jumpToHighlightRects } = usePdfJump();
  const getPdfPageProxy = usePdf((state) => state.getPdfPageProxy);

  const handleClick = async () => {
    const pageProxy = getPdfPageProxy(result.pageNumber);
    const rects = await calculateHighlightRects(pageProxy, {
      pageNumber: result.pageNumber,
      text: result.text,
      matchIndex: result.matchIndex,
      searchText: originalSearchText,
    });
    jumpToHighlightRects(rects, "pixels");
  };

  return (
    <div
      className="flex py-2 hover:bg-gray-50 flex-col cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black">{result.text}</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-800">
        <span className="ml-auto">Page {result.pageNumber}</span>
      </div>
    </div>
  );
};

function SearchPanel() {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText] = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  const [limit, setLimit] = useState(INITIAL_SEARCH_LIMIT);
  const { searchResults: results, search } = useSearch();

  useEffect(() => {
    setLimit(INITIAL_SEARCH_LIMIT);
    search(debouncedSearchText, { limit: INITIAL_SEARCH_LIMIT });
  }, [debouncedSearchText]);

  const handleLoadMore = async () => {
    const newLimit = limit + SEARCH_INCREMENT;
    await search(debouncedSearchText, { limit: newLimit });
    setLimit(newLimit);
  };

  const hasResults = results.exactMatches.length > 0 || results.fuzzyMatches.length > 0;
  const showNoResults = searchText && !hasResults;

  return (
    <div style={{ width: 340, height: 600, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div className="px-4 py-4 border-b border-gray-200">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search in document..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-4">
          {showNoResults ? (
            <div className="text-center py-4 text-gray-700">
              No results found
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {results.exactMatches.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-black">
                    Exact Matches
                  </h3>
                  <div className="divide-y divide-gray-100">
                    {results.exactMatches.map((result) => (
                      <ResultItem
                        key={`${result.pageNumber}-${result.matchIndex}`}
                        result={result}
                        originalSearchText={searchText}
                      />
                    ))}
                  </div>
                </div>
              )}
              {results.fuzzyMatches.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-black">
                    Fuzzy Matches
                  </h3>
                  <div className="divide-y divide-gray-100">
                    {results.fuzzyMatches.map((result) => (
                      <ResultItem
                        key={`fuzzy-${result.pageNumber}-${result.matchIndex}`}
                        result={result}
                        originalSearchText={searchText}
                      />
                    ))}
                  </div>
                </div>
              )}
              {results.hasMoreResults && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-2 px-4 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Load More Results
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightsPanel({
  selectedExample,
  setSelectedExample,
  highlights,
  loading,
}: {
  selectedExample: number | null;
  setSelectedExample: (id: number) => void;
  highlights: TextChunk[];
  loading: boolean;
}) {
  const setHighlight = usePdf(state => state.setHighlight);
  const { jumpToHighlightRects } = usePdfJump();

  const handleExampleClick = (example: TextChunk) => {
    setSelectedExample(example.page_number);
    const highlightRect = textChunkToHighlightRect(example);
    setHighlight([highlightRect]);
    jumpToHighlightRects([highlightRect], "pixels");
  };

  return (
    <div style={{ width: 340, height: 600, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black">Transcript</h2>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading transcript...</div>
        ) : (
          <div className="p-2 space-y-2">
            {highlights.map((chunk, index) => (
              <div
                key={`${chunk.page_number}-${index}`}
                onClick={() => handleExampleClick(chunk)}
                className={`cursor-pointer p-2 rounded transition-colors duration-150 hover:bg-gray-50
                  ${selectedExample === chunk.page_number
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700"
                  }`}
                style={{ wordBreak: 'break-word', overflowX: 'hidden' }}
              >
                <div className="text-sm leading-relaxed break-words">{chunk.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function textChunkToHighlightRect(chunk: TextChunk): HighlightRect {
  return {
    pageNumber: chunk.page_number,
    left: chunk.px_left,
    top: chunk.px_bottom,
    width: chunk.width,
    height: chunk.height,
  };
}

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState(DEFAULT_PDF_URL);
  const [displayedPdfUrl, setDisplayedPdfUrl] = useState('');
  const [selectedExample, setSelectedExample] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [highlights, setHighlights] = useState<TextChunk[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHighlights = async (file?: File, url?: string, by: "spans" | "lines" | "blocks" = "blocks") => {
    setLoading(true);
    try {
      let response;

      if (file) {
        // Handle file upload
        const formData = new FormData();
        formData.append('pdf_file', file);
        formData.append('by', by);

        response = await fetch('/api/highlights', {
          method: 'POST',
          body: formData,
        });
      } else if (url) {
        // Handle URL
        response = await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_url: url, by }),
        });
      } else {
        throw new Error('Either file or URL must be provided');
      }

      if (response.ok) {
        const data = await response.json();
        setHighlights(data.text_chunks || []);
      } else {
        console.error('Failed to load highlights:', response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pdfFile) {
      loadHighlights(pdfFile, undefined);
      setDisplayedPdfUrl(blobUrl || '');
    } else if (pdfUrl) {
      loadHighlights(undefined, pdfUrl);
      setDisplayedPdfUrl(pdfUrl);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.type === 'application/pdf') {
      setPdfFile(file);
      setPdfUrl(''); // Clear URL when file is selected
      // Create a blob URL for the file
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      setDisplayedPdfUrl(url);
      loadHighlights(file, undefined);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (pdfFile) {
      handleFileSelect(pdfFile);
    } else {
      alert('Please drop a valid PDF file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearFile = () => {
    setPdfFile(null);
    setHighlights([]);
    setDisplayedPdfUrl('');
    setPdfUrl('');
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-sans">
      <form onSubmit={handleSubmit} className="mb-6 w-full max-w-4xl mx-auto">
        <div className="relative">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !pdfFile && fileInputRef.current?.click()}
            className={`relative flex items-center bg-white rounded-xl shadow-lg border-2 transition-all duration-200 ${isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
              } ${!pdfFile ? 'cursor-pointer' : ''}`}
          >
            {/* URL Input */}
            <input
              type="url"
              value={pdfUrl}
              onChange={e => setPdfUrl(e.target.value)}
              placeholder={pdfFile ? `📄 ${pdfFile.name} (click to change)` : "Enter PDF URL or drag & drop file here..."}
              className="flex-1 p-4 pr-32 text-gray-700 bg-transparent border-none outline-none placeholder-gray-500 disabled:bg-transparent"
              disabled={!!pdfFile}
              onClick={(e) => pdfFile && (e.stopPropagation(), fileInputRef.current?.click())}
            />

            {/* File Input (hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pr-4">
              {pdfFile && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Clear file"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                disabled={!pdfUrl && !pdfFile}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Load
              </button>
            </div>

            {/* Drag Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-500/10 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="text-blue-600 font-medium">Drop PDF here</div>
              </div>
            )}
          </div>

          {/* Click to browse hint */}
          {!pdfFile && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              Click anywhere in the bar to browse files
            </div>
          )}
        </div>
      </form>
      {displayedPdfUrl && (
        <div className="flex justify-center w-full mt-8">
          <Root source={displayedPdfUrl} className="w-full h-full flex justify-center">
            <Search>
              <div className="bg-white rounded-xl shadow-lg flex flex-row items-stretch" style={{ height: 600, minWidth: 1480 }}>
                <SearchPanel />
                <div style={{ width: 800, height: 600, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Pages className="p-4">
                    <Page>
                      <CanvasLayer />
                      <TextLayer />
                      <HighlightLayer className="bg-yellow-200/70" />
                    </Page>
                  </Pages>
                </div>
                <HighlightsPanel
                  selectedExample={selectedExample}
                  setSelectedExample={setSelectedExample}
                  highlights={highlights}
                  loading={loading}
                />
              </div>
            </Search>
          </Root>
        </div>
      )}
    </div>
  );
}