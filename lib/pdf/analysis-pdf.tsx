/**
 * Analysis PDF Document Component
 *
 * React-PDF component for generating professional analysis result PDFs.
 * Includes template information, sections, evidence citations, action items,
 * decisions, and quotes with professional business report styling.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Analysis, Transcript } from "@/types";
import type { Template } from "@/types";

/**
 * Register fonts for better typography
 */
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

/**
 * PDF Stylesheet with professional business report styling
 */
const styles = StyleSheet.create({
  // Page layout
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 50,
    fontSize: 11,
    fontFamily: "Helvetica",
  },

  // Header section
  header: {
    marginBottom: 25,
    borderBottom: "2 solid #1a1a1a",
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#1a1a1a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 3,
  },

  // Table of Contents
  tocContainer: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  tocTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1a1a1a",
  },
  tocItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 10,
  },
  tocLabel: {
    flex: 1,
    fontSize: 10,
    color: "#333333",
  },
  tocPage: {
    fontSize: 10,
    color: "#666666",
  },

  // Metadata section
  metadata: {
    marginBottom: 25,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  metadataLabel: {
    width: 120,
    fontWeight: "bold",
    color: "#333333",
    fontSize: 10,
  },
  metadataValue: {
    flex: 1,
    color: "#555555",
    fontSize: 10,
  },

  // Content section
  content: {
    flex: 1,
  },

  // Section styles
  section: {
    marginBottom: 25,
    pageBreakInside: "avoid",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1a1a1a",
    borderBottom: "1 solid #cccccc",
    paddingBottom: 6,
  },
  sectionContent: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.6,
    marginBottom: 12,
  },

  // Evidence styles
  evidenceContainer: {
    marginTop: 10,
  },
  evidenceTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#555555",
    marginBottom: 6,
  },
  evidenceItem: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeft: "2 solid #e5e5e5",
  },
  evidenceText: {
    fontSize: 9,
    color: "#555555",
    fontStyle: "italic",
    marginBottom: 3,
  },
  evidenceTimestamp: {
    fontSize: 8,
    color: "#999999",
    backgroundColor: "#f5f5f5",
    padding: "2 4",
    borderRadius: 2,
  },

  // Action Items table
  actionItemsSection: {
    marginBottom: 25,
    pageBreakInside: "avoid",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#333333",
    padding: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #e5e5e5",
    padding: 8,
  },
  tableRowAlt: {
    backgroundColor: "#f9f9f9",
  },
  tableCell: {
    fontSize: 9,
    color: "#333333",
  },
  taskCell: {
    width: "45%",
    paddingRight: 8,
  },
  ownerCell: {
    width: "25%",
    paddingRight: 8,
  },
  deadlineCell: {
    width: "20%",
    paddingRight: 8,
  },
  timestampCell: {
    width: "10%",
    fontSize: 8,
    color: "#666666",
  },

  // Decisions timeline
  decisionsSection: {
    marginBottom: 25,
  },
  decisionItem: {
    marginBottom: 15,
    paddingLeft: 15,
    borderLeft: "3 solid #0066cc",
    pageBreakInside: "avoid",
  },
  decisionText: {
    fontSize: 11,
    color: "#333333",
    marginBottom: 4,
    fontWeight: "bold",
  },
  decisionContext: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 3,
    fontStyle: "italic",
  },
  decisionTimestamp: {
    fontSize: 8,
    color: "#666666",
    backgroundColor: "#f0f0f0",
    padding: "2 4",
    borderRadius: 2,
  },

  // Quotes section
  quotesSection: {
    marginBottom: 25,
  },
  quoteItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderLeft: "3 solid #999999",
    pageBreakInside: "avoid",
  },
  quoteText: {
    fontSize: 11,
    color: "#333333",
    fontStyle: "italic",
    marginBottom: 6,
  },
  quoteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quoteSpeaker: {
    fontSize: 9,
    color: "#0066cc",
    fontWeight: "bold",
  },
  quoteTimestamp: {
    fontSize: 8,
    color: "#666666",
  },

  // Summary section
  summarySection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: "#f0f7ff",
    borderRadius: 4,
    borderLeft: "4 solid #0066cc",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#0066cc",
  },
  summaryText: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.8,
  },

  // Footer section
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #e5e5e5",
    paddingTop: 8,
    fontSize: 8,
    color: "#999999",
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: "right",
  },
  branding: {
    fontSize: 7,
    color: "#999999",
    marginTop: 2,
  },
});

/**
 * Helper function to format timestamp
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Helper function to format date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Props for AnalysisPDFDocument
 */
export interface AnalysisPDFDocumentProps {
  /** The analysis results to render */
  analysis: Analysis;
  /** The source transcript for context */
  transcript: Transcript;
  /** Optional template information */
  template?: Template;
  /** Whether to include table of contents */
  includeTableOfContents?: boolean;
}

/**
 * Header Component
 */
const PDFHeader: React.FC<{
  transcript: Transcript;
  template?: Template;
}> = ({ transcript, template }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Analysis Report</Text>
    <Text style={styles.headerSubtitle}>{transcript.filename}</Text>
    {template && (
      <Text style={styles.headerSubtitle}>Template: {template.name}</Text>
    )}
    <Text style={styles.headerSubtitle}>
      Generated on {formatDate(new Date())}
    </Text>
  </View>
);

/**
 * Metadata Component
 */
const PDFMetadata: React.FC<{
  analysis: Analysis;
  transcript: Transcript;
  template?: Template;
}> = ({ analysis, transcript, template }) => (
  <View style={styles.metadata}>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Source File:</Text>
      <Text style={styles.metadataValue}>{transcript.filename}</Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Analyzed:</Text>
      <Text style={styles.metadataValue}>{formatDate(analysis.createdAt)}</Text>
    </View>
    {template && (
      <>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Template:</Text>
          <Text style={styles.metadataValue}>{template.name}</Text>
        </View>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Template Category:</Text>
          <Text style={styles.metadataValue}>
            {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
          </Text>
        </View>
      </>
    )}
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Sections:</Text>
      <Text style={styles.metadataValue}>
        {analysis.results.sections.length}
      </Text>
    </View>
    {analysis.results.actionItems && analysis.results.actionItems.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Action Items:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.actionItems.length}
        </Text>
      </View>
    )}
    {analysis.results.decisions && analysis.results.decisions.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Decisions:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.decisions.length}
        </Text>
      </View>
    )}
  </View>
);

/**
 * Table of Contents Component
 */
const TableOfContents: React.FC<{ analysis: Analysis }> = ({ analysis }) => (
  <View style={styles.tocContainer}>
    <Text style={styles.tocTitle}>Table of Contents</Text>
    {analysis.results.summary && (
      <View style={styles.tocItem}>
        <Text style={styles.tocLabel}>Executive Summary</Text>
      </View>
    )}
    {analysis.results.sections.map((section, index) => (
      <View key={index} style={styles.tocItem}>
        <Text style={styles.tocLabel}>{section.name}</Text>
      </View>
    ))}
    {analysis.results.actionItems && analysis.results.actionItems.length > 0 && (
      <View style={styles.tocItem}>
        <Text style={styles.tocLabel}>Action Items</Text>
      </View>
    )}
    {analysis.results.decisions && analysis.results.decisions.length > 0 && (
      <View style={styles.tocItem}>
        <Text style={styles.tocLabel}>Decisions Timeline</Text>
      </View>
    )}
    {analysis.results.quotes && analysis.results.quotes.length > 0 && (
      <View style={styles.tocItem}>
        <Text style={styles.tocLabel}>Notable Quotes</Text>
      </View>
    )}
  </View>
);

/**
 * Summary Component
 */
const SummarySection: React.FC<{ summary: string }> = ({ summary }) => (
  <View style={styles.summarySection} wrap={false}>
    <Text style={styles.summaryTitle}>Executive Summary</Text>
    <Text style={styles.summaryText}>{summary}</Text>
  </View>
);

/**
 * Analysis Section Component
 */
const AnalysisSection: React.FC<{
  section: Analysis["results"]["sections"][0];
}> = ({ section }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{section.name}</Text>
    <Text style={styles.sectionContent}>{section.content}</Text>

    {section.evidence && section.evidence.length > 0 && (
      <View style={styles.evidenceContainer}>
        <Text style={styles.evidenceTitle}>Evidence Citations:</Text>
        {section.evidence.map((evidence, index) => (
          <View key={index} style={styles.evidenceItem}>
            <Text style={styles.evidenceText}>&quot;{evidence.text}&quot;</Text>
            <Text style={styles.evidenceTimestamp}>
              {formatTimestamp(evidence.start)} - {formatTimestamp(evidence.end)}{" "}
              (Relevance: {(evidence.relevance * 100).toFixed(0)}%)
            </Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

/**
 * Action Items Table Component
 */
const ActionItemsTable: React.FC<{
  actionItems: NonNullable<Analysis["results"]["actionItems"]>;
}> = ({ actionItems }) => (
  <View style={styles.actionItemsSection}>
    <Text style={styles.sectionTitle}>Action Items</Text>

    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.taskCell]}>Task</Text>
      <Text style={[styles.tableHeaderCell, styles.ownerCell]}>Owner</Text>
      <Text style={[styles.tableHeaderCell, styles.deadlineCell]}>Deadline</Text>
      <Text style={[styles.tableHeaderCell, styles.timestampCell]}>Time</Text>
    </View>

    {actionItems.map((item, index) => (
      <View
        key={index}
        style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
      >
        <Text style={[styles.tableCell, styles.taskCell]}>{item.task}</Text>
        <Text style={[styles.tableCell, styles.ownerCell]}>
          {item.owner || "-"}
        </Text>
        <Text style={[styles.tableCell, styles.deadlineCell]}>
          {item.deadline || "-"}
        </Text>
        <Text style={[styles.tableCell, styles.timestampCell]}>
          {item.timestamp !== undefined ? formatTimestamp(item.timestamp) : "-"}
        </Text>
      </View>
    ))}
  </View>
);

/**
 * Decisions Timeline Component
 */
const DecisionsTimeline: React.FC<{
  decisions: NonNullable<Analysis["results"]["decisions"]>;
}> = ({ decisions }) => (
  <View style={styles.decisionsSection}>
    <Text style={styles.sectionTitle}>Decisions Timeline</Text>

    {decisions.map((decision, index) => (
      <View key={index} style={styles.decisionItem}>
        <Text style={styles.decisionText}>{decision.decision}</Text>
        {decision.context && (
          <Text style={styles.decisionContext}>{decision.context}</Text>
        )}
        <Text style={styles.decisionTimestamp}>
          {formatTimestamp(decision.timestamp)}
        </Text>
      </View>
    ))}
  </View>
);

/**
 * Quotes Section Component
 */
const QuotesSection: React.FC<{
  quotes: NonNullable<Analysis["results"]["quotes"]>;
}> = ({ quotes }) => (
  <View style={styles.quotesSection}>
    <Text style={styles.sectionTitle}>Notable Quotes</Text>

    {quotes.map((quote, index) => (
      <View key={index} style={styles.quoteItem}>
        <Text style={styles.quoteText}>&quot;{quote.text}&quot;</Text>
        <View style={styles.quoteFooter}>
          {quote.speaker && (
            <Text style={styles.quoteSpeaker}>— {quote.speaker}</Text>
          )}
          <Text style={styles.quoteTimestamp}>
            {formatTimestamp(quote.timestamp)}
          </Text>
        </View>
      </View>
    ))}
  </View>
);

/**
 * Footer Component
 */
const PDFFooter: React.FC<{ transcript: Transcript }> = ({ transcript }) => (
  <View style={styles.footer} fixed>
    <View style={styles.footerLeft}>
      <Text>Analysis Report - {transcript.filename}</Text>
      <Text style={styles.branding}>
        Generated with Meeting Transcriber
      </Text>
    </View>
    <View style={styles.footerRight}>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  </View>
);

/**
 * AnalysisPDFDocument Component
 *
 * Main PDF document component that renders complete analysis results
 * with professional formatting suitable for business reports.
 *
 * @example
 * ```tsx
 * import { pdf } from '@react-pdf/renderer';
 * import { AnalysisPDFDocument } from './analysis-pdf';
 *
 * const blob = await pdf(
 *   <AnalysisPDFDocument analysis={analysis} transcript={transcript} />
 * ).toBlob();
 * ```
 */
export const AnalysisPDFDocument: React.FC<AnalysisPDFDocumentProps> = ({
  analysis,
  transcript,
  template,
  includeTableOfContents = true,
}) => {
  return (
    <Document
      title={`Analysis - ${transcript.filename}`}
      author="Meeting Transcriber"
      subject="Transcript Analysis Report"
      keywords="analysis, transcript, meeting, report"
      creator="Meeting Transcriber"
    >
      <Page size="A4" style={styles.page}>
        <PDFHeader transcript={transcript} template={template} />
        <PDFMetadata
          analysis={analysis}
          transcript={transcript}
          template={template}
        />

        {includeTableOfContents && <TableOfContents analysis={analysis} />}

        <View style={styles.content}>
          {/* Executive Summary */}
          {analysis.results.summary && (
            <SummarySection summary={analysis.results.summary} />
          )}

          {/* Analysis Sections */}
          {analysis.results.sections.map((section, index) => (
            <AnalysisSection key={index} section={section} />
          ))}

          {/* Action Items Table */}
          {analysis.results.actionItems &&
            analysis.results.actionItems.length > 0 && (
              <ActionItemsTable actionItems={analysis.results.actionItems} />
            )}

          {/* Decisions Timeline */}
          {analysis.results.decisions &&
            analysis.results.decisions.length > 0 && (
              <DecisionsTimeline decisions={analysis.results.decisions} />
            )}

          {/* Notable Quotes */}
          {analysis.results.quotes && analysis.results.quotes.length > 0 && (
            <QuotesSection quotes={analysis.results.quotes} />
          )}
        </View>

        <PDFFooter transcript={transcript} />
      </Page>
    </Document>
  );
};

/**
 * Export default for convenience
 */
export default AnalysisPDFDocument;
