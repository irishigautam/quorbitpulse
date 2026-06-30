/**
 * inf4 — OpenAPI spec for ChatGPT Plugin / GPT Action.
 * Defines the actions ChatGPT can take via Quorbit.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const spec = {
    openapi: '3.0.1',
    info: {
      title: 'Quorbit Hiring API',
      description: 'Score candidates against jobs, search your candidate pool, and retrieve pipeline data.',
      version: 'v1',
    },
    servers: [{ url: 'https://quorbit.in' }],
    security: [{ BearerAuth: [] }],
    paths: {
      '/api/v1/match': {
        post: {
          operationId: 'scoreCandidate',
          summary: 'Score a candidate profile against a job',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['candidate', 'job'],
                  properties: {
                    candidate: {
                      type: 'object',
                      properties: {
                        skills:           { type: 'array', items: { type: 'string' } },
                        domain:           { type: 'array', items: { type: 'string' } },
                        seniority:        { type: 'string' },
                        years_experience: { type: 'number' },
                      },
                    },
                    job: {
                      type: 'object',
                      properties: {
                        title:          { type: 'string' },
                        skills:         { type: 'array', items: { type: 'string' } },
                        domain:         { type: 'array', items: { type: 'string' } },
                        min_experience: { type: 'number' },
                        description:    { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Match score and breakdown',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      match_score: { type: 'number' },
                      breakdown: {
                        type: 'object',
                        properties: {
                          skill_score:      { type: 'number' },
                          domain_score:     { type: 'number' },
                          experience_score: { type: 'number' },
                          seniority_score:  { type: 'number' },
                        },
                      },
                      api_version: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/candidates/search': {
        get: {
          operationId: 'searchCandidates',
          summary: 'Boolean search across your candidate pool',
          parameters: [
            { name: 'q',         in: 'query', schema: { type: 'string' }, description: 'Boolean query (AND/OR/NOT)' },
            { name: 'tag',       in: 'query', schema: { type: 'string' } },
            { name: 'min_score', in: 'query', schema: { type: 'number' } },
            { name: 'limit',     in: 'query', schema: { type: 'number' } },
          ],
          responses: {
            '200': { description: 'Search results' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: { 'Access-Control-Allow-Origin': 'https://chat.openai.com' },
  })
}
