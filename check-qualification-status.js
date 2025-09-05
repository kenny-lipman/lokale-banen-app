const { supabaseService } = require('./lib/supabase-service');

async function checkQualificationStatus() {
  try {
    console.log('Fetching companies to check qualification_status values...');
    
    // Get a larger sample of companies
    const result = await supabaseService.getCompanies({ limit: 1000 });
    const companies = result.data || [];
    
    console.log(`Found ${companies.length} companies`);
    
    // Count unique qualification_status values
    const statusCounts = {};
    
    companies.forEach(company => {
      const status = company.qualification_status;
      const statusKey = status === null || status === undefined ? 'null' : status;
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    });
    
    console.log('\nUnique qualification_status values and their counts:');
    console.log('='.repeat(50));
    
    // Sort by count descending
    const sortedStatuses = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1]);
    
    sortedStatuses.forEach(([status, count]) => {
      console.log(`${status.padEnd(15)} : ${count.toLocaleString()}`);
    });
    
    console.log('='.repeat(50));
    console.log(`Total companies: ${companies.length.toLocaleString()}`);
    
  } catch (error) {
    console.error('Error checking qualification status:', error);
  }
}

checkQualificationStatus();