/**
 * Database Wrapper Verification
 * 
 * Quick verification that all database functions are properly exported
 * and have correct type signatures.
 */

import type { Transcript } from "../types/transcript";
import type { Template } from "../types/template";
import type { Analysis } from "../types/analysis";

import {
  DatabaseError,
  saveTranscript,
  getTranscript,
  getAllTranscripts,
  deleteTranscript,
  saveTemplate,
  getTemplate,
  getAllTemplates,
  deleteTemplate,
  saveAnalysis,
  getAnalysisByTranscript,
  deleteAnalysis,
  getStorageEstimate,
  calculateStorageUsage,
  closeDatabase,
  deleteDatabase,
  type StorageEstimate,
} from "./db";

export function verifyDatabaseLayer() {
  const typeChecks = {
    saveTranscript: saveTranscript as (transcript: Transcript) => Promise<string>,
    getTranscript: getTranscript as (id: string) => Promise<Transcript | undefined>,
    getAllTranscripts: getAllTranscripts as () => Promise<Transcript[]>,
    deleteTranscript: deleteTranscript as (id: string) => Promise<void>,
    saveTemplate: saveTemplate as (template: Template) => Promise<string>,
    getTemplate: getTemplate as (id: string) => Promise<Template | undefined>,
    getAllTemplates: getAllTemplates as () => Promise<Template[]>,
    deleteTemplate: deleteTemplate as (id: string) => Promise<void>,
    saveAnalysis: saveAnalysis as (analysis: Analysis) => Promise<string>,
    getAnalysisByTranscript: getAnalysisByTranscript as (transcriptId: string) => Promise<Analysis[]>,
    deleteAnalysis: deleteAnalysis as (id: string) => Promise<void>,
    getStorageEstimate: getStorageEstimate as () => Promise<StorageEstimate>,
    calculateStorageUsage: calculateStorageUsage as () => Promise<{
      transcriptCount: number;
      templateCount: number;
      analysisCount: number;
      totalRecords: number;
    }>,
    closeDatabase: closeDatabase as () => void,
    deleteDatabase: deleteDatabase as () => Promise<void>,
  } as const;

  const errorCheck = new DatabaseError("test", "TEST_CODE", new Error("original"));
  const storageEstimate: StorageEstimate = {
    usage: 1024,
    quota: 10240,
    percentUsed: 10,
    usageFormatted: "1 KB",
    quotaFormatted: "10 KB",
  };

  return {
    typeChecks,
    errorCheck,
    storageEstimate,
  };
}
