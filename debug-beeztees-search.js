#!/usr/bin/env node

/**
 * Debug script to test the contacts search API with 'beeztees' query
 * Run this to reproduce the HTTP 500 error
 */

const fetch = require('node-fetch');

async function testContactsSearch() {
  const baseUrl = 'http://localhost:3000'; // Adjust if different
  const searchTerm = 'beeztees';

  console.log(`Testing contacts search API with term: "${searchTerm}"`);
  console.log('URL:', `${baseUrl}/api/contacts?search=${encodeURIComponent(searchTerm)}&page=1&limit=15`);

  try {
    const response = await fetch(`${baseUrl}/api/contacts?search=${encodeURIComponent(searchTerm)}&page=1&limit=15`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper auth token, but we can see the error structure
      }
    });

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.log('Error detected!');
      console.log('Error type:', typeof data.details);
      console.log('Error details raw:', data.details);

      if (data.details === '[object Object]') {
        console.log('CONFIRMED: This is the [object Object] bug!');
      }
    }

  } catch (error) {
    console.error('Network error:', error.message);
  }
}

testContactsSearch();