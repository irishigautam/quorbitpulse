/**
 * inf4 — ChatGPT Plugin / GPT Action manifest.
 * Served at /.well-known/ai-plugin.json for ChatGPT plugin discovery.
 * Extends MCP coverage to ChatGPT users.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const manifest = {
    schema_version: 'v1',
    name_for_human: 'Quorbit Hiring',
    name_for_model: 'quorbit_hiring',
    description_for_human: 'Search candidates, score profiles against jobs, and manage your Quorbit hiring pipeline.',
    description_for_model: 'Quorbit is a hiring platform that matches candidates to jobs using AI fingerprinting. Use this plugin to search the candidate pool, score a candidate profile against a job description, or retrieve pipeline stages.',
    auth: {
      type: 'user_http',
      authorization_type: 'bearer',
    },
    api: {
      type: 'openapi',
      url: 'https://quorbit.in/api/v1/openapi-gpt.json',
      is_user_authenticated: true,
    },
    logo_url: 'https://quorbit.in/logo.png',
    contact_email: 'api@quorbit.in',
    legal_info_url: 'https://quorbit.in/privacy',
  }

  return NextResponse.json(manifest, {
    headers: { 'Access-Control-Allow-Origin': 'https://chat.openai.com' },
  })
}
