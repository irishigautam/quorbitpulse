import { NextResponse } from 'next/server'

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'JobPulse API',
    version: '1.0.0',
    description: 'Free, open, read-only job data API. No authentication required.',
    contact: { email: 'hello@quorbit.com' },
  },
  servers: [{ url: 'https://jobpulse.io/api/v1', description: 'Production' }],
  paths: {
    '/jobs': {
      get: {
        summary: 'List jobs',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Full-text search' },
          { name: 'location', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'internship', 'freelance'] } },
          { name: 'remote', in: 'query', schema: { type: 'boolean' } },
          { name: 'skills', in: 'query', schema: { type: 'string' }, description: 'Comma-separated skills' },
          { name: 'company_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'posted_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'List of jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { '$ref': '#/components/schemas/Job' } },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Get a job',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Job', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Job' } } } },
          '404': { description: 'Not found' },
        },
      },
    },
    '/companies': {
      get: {
        summary: 'List companies',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': { description: 'Companies with active job count' },
        },
      },
    },
    '/companies/{id}/jobs': {
      get: {
        summary: "Get a company's jobs",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Company + jobs' },
          '404': { description: 'Not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          job_type: { type: 'string' },
          remote: { type: 'boolean' },
          salary_min: { type: 'integer', nullable: true },
          salary_max: { type: 'integer', nullable: true },
          salary_currency: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          apply_url: { type: 'string', nullable: true },
          apply_email: { type: 'string', nullable: true },
          status: { type: 'string' },
          views: { type: 'integer' },
          posted_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time' },
          company: { '$ref': '#/components/schemas/Company' },
        },
      },
      Company: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          website: { type: 'string' },
          logo_url: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
        },
      },
    },
  },
}

export function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
