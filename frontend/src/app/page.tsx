// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CanvasLayer, HighlightLayer, Page, Pages, Root, TextLayer, usePdfJump, usePdf, Search, useSearch, calculateHighlightRects, SearchResult } from "@anaralabs/lector";
import "@/lib/setup";
import { useDebounce } from "use-debounce";

const EXAMPLES = [
  {
    id: 1,
    title: "Highlight 1",
    text: "Attention Is All You Need",
    highlights: [
      {
        pageNumber: 1,
        left: 211,
        top: 116,
        width: 399 - 211,
        height: 17,
      },
    ],
  },
  {
    id: 2,
    title: "Highlight 2",
    text: "Another highlight example",
    highlights: [
      {
        pageNumber: 9,
        left: 211.488,
        top: 113.046,
        width: 399.893 - 211.488,
        height: 113.046 - 101.168,
      },
    ],
  },
];

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
}: {
  selectedExample: number | null;
  setSelectedExample: (id: number) => void;
}) {
  const setHighlight = usePdf(state => state.setHighlight);
  const { jumpToHighlightRects } = usePdfJump();

  const handleExampleClick = (example: typeof EXAMPLES[0]) => {
    setSelectedExample(example.id);
    setHighlight(example.highlights);
    jumpToHighlightRects(example.highlights, "pixels");
  };

  return (
    <div style={{ width: 340, height: 600, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold mb-6 text-black">Highlights</h2>
        <div className="space-y-4">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => handleExampleClick(example)}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                ${selectedExample === example.id
                  ? "bg-yellow-100 border-yellow-400 shadow-md"
                  : "bg-white hover:bg-gray-100 border-gray-200 shadow-sm"
                }`}
            >
              <div className="font-semibold text-black mb-1">{example.title}</div>
              <div className="text-sm text-gray-800">{example.text}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState(DEFAULT_PDF_URL);
  const [displayedPdfUrl, setDisplayedPdfUrl] = useState('');
  const [selectedExample, setSelectedExample] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDisplayedPdfUrl(pdfUrl);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-sans">
      <form onSubmit={handleSubmit} className="flex gap-4 mb-6 w-full max-w-2xl mx-auto">
        <input
          type="url"
          value={pdfUrl}
          onChange={e => setPdfUrl(e.target.value)}
          placeholder="Enter PDF URL..."
          className="flex-grow p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
          required
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200"
        >
          Load PDF
        </button>
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
                />
              </div>
            </Search>
          </Root>
        </div>
      )}
    </div>
  );
}