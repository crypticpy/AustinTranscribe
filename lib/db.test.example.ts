/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example usage and test cases for the database wrapper
 * 
 * This file demonstrates how to use the database API.
 * To run these tests, you'll need to set up a testing framework like Jest.
 */

import {
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
  DatabaseError
} from './db';

import type { Transcript } from '../types/transcript';
import type { Template } from '../types/template';
import type { Analysis } from '../types/analysis';

// Example: Creating and saving a transcript
async function exampleSaveTranscript() {
  const transcript: Transcript = {
    id: 'transcript-1',
    filename: 'meeting-2024-01-15.mp3',
    text: 'Full transcript text here...',
    segments: [
      {
        index: 0,
        start: 0,
        end: 5.2,
        text: 'Hello everyone, welcome to the meeting.',
        speaker: 'John'
      },
      {
        index: 1,
        start: 5.2,
        end: 10.5,
        text: 'Today we will discuss the project timeline.',
        speaker: 'Jane'
      }
    ],
    createdAt: new Date(),
    metadata: {
      model: 'whisper-1',
      language: 'en',
      fileSize: 1024000,
      duration: 300
    }
  };

  try {
    const id = await saveTranscript(transcript);
    console.log(`Transcript saved with ID: ${id}`);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Database error: ${error.message} (${error.code})`);
    }
  }
}

// Example: Retrieving all transcripts
async function exampleGetAllTranscripts() {
  try {
    const transcripts = await getAllTranscripts();
    console.log(`Found ${transcripts.length} transcripts`);
    
    transcripts.forEach(t => {
      console.log(`- ${t.filename} (${t.metadata.duration}s)`);
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Failed to retrieve transcripts: ${error.message}`);
    }
  }
}

// Example: Creating and saving a custom template
async function exampleSaveTemplate() {
  const template: Template = {
    id: 'template-1',
    name: 'Project Meeting Notes',
    description: 'Extract key decisions and action items from project meetings',
    icon: 'FileText',
    category: 'meeting',
    sections: [
      {
        id: 'section-1',
        name: 'Key Decisions',
        prompt: 'Extract all important decisions made during the meeting',
        extractEvidence: true,
        outputFormat: 'bullet_points'
      },
      {
        id: 'section-2',
        name: 'Action Items',
        prompt: 'List all action items with owners and deadlines',
        extractEvidence: true,
        outputFormat: 'table'
      }
    ],
    outputs: ['decisions', 'action_items'],
    isCustom: true,
    createdAt: new Date()
  };

  try {
    const id = await saveTemplate(template);
    console.log(`Template saved with ID: ${id}`);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Failed to save template: ${error.message}`);
    }
  }
}

// Example: Deleting a custom template
async function exampleDeleteTemplate() {
  try {
    await deleteTemplate('template-1');
    console.log('Template deleted successfully');
  } catch (error) {
    if (error instanceof DatabaseError) {
      if (error.code === 'NOT_CUSTOM') {
        console.error('Cannot delete built-in templates');
      } else {
        console.error(`Failed to delete template: ${error.message}`);
      }
    }
  }
}

// Example: Saving an analysis
async function exampleSaveAnalysis() {
  const analysis: Analysis = {
    id: 'analysis-1',
    transcriptId: 'transcript-1',
    templateId: 'template-1',
    results: {
      summary: 'This was a productive project meeting...',
      sections: [
        {
          name: 'Key Decisions',
          content: '- Approved the new timeline\n- Agreed on the tech stack',
          evidence: [
            {
              text: 'I think we should approve the new timeline',
              start: 120,
              end: 125,
              relevance: 0.95
            }
          ]
        }
      ],
      actionItems: [
        {
          id: 'action-1',
          task: 'Update the project roadmap',
          owner: 'John',
          deadline: 'Friday',
          timestamp: 180
        }
      ]
    },
    createdAt: new Date()
  };

  try {
    const id = await saveAnalysis(analysis);
    console.log(`Analysis saved with ID: ${id}`);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Failed to save analysis: ${error.message}`);
    }
  }
}

// Example: Getting all analyses for a transcript
async function exampleGetAnalyses() {
  try {
    const analyses = await getAnalysisByTranscript('transcript-1');
    console.log(`Found ${analyses.length} analyses for this transcript`);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Failed to retrieve analyses: ${error.message}`);
    }
  }
}

// Example: Monitoring storage usage
async function exampleStorageMonitoring() {
  try {
    // Get browser storage estimate
    const estimate = await getStorageEstimate();
    console.log(`Storage used: ${estimate.usageFormatted}`);
    if (estimate.quotaFormatted) {
      console.log(`Storage quota: ${estimate.quotaFormatted}`);
      console.log(`Usage: ${estimate.percentUsed?.toFixed(2)}%`);
    }

    // Get detailed record counts
    const usage = await calculateStorageUsage();
    console.log(`\nDetailed usage:`);
    console.log(`- Transcripts: ${usage.transcriptCount}`);
    console.log(`- Templates: ${usage.templateCount}`);
    console.log(`- Analyses: ${usage.analysisCount}`);
    console.log(`- Total records: ${usage.totalRecords}`);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(`Storage monitoring failed: ${error.message}`);
    }
  }
}

// Example: Handling quota exceeded errors
async function exampleQuotaHandling() {
  const largeTranscript: Transcript = {
    id: 'large-transcript',
    filename: 'very-long-meeting.mp3',
    text: 'Very large transcript...'.repeat(100000),
    segments: [],
    createdAt: new Date(),
    metadata: {
      model: 'whisper-1',
      fileSize: 50000000,
      duration: 7200
    }
  };

  try {
    await saveTranscript(largeTranscript);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'QUOTA_EXCEEDED') {
      console.error('Storage quota exceeded!');
      
      // Get storage info to show user
      const estimate = await getStorageEstimate();
      console.log(`You are using ${estimate.usageFormatted} of storage.`);
      console.log('Please delete some transcripts to free up space.');
    }
  }
}

// Run all examples
export async function runAllExamples() {
  console.log('=== Database Wrapper Examples ===\n');
  
  await exampleSaveTranscript();
  await exampleGetAllTranscripts();
  await exampleSaveTemplate();
  await exampleDeleteTemplate();
  await exampleSaveAnalysis();
  await exampleGetAnalyses();
  await exampleStorageMonitoring();
  await exampleQuotaHandling();
  
  console.log('\n=== Examples Complete ===');
}
