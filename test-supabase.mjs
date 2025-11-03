import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING')
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'MISSING')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

try {
  console.log('🔍 Testing simple query...')
  const { data, error } = await supabase
    .from('user_organization_roles')
    .select('user_id')
    .limit(1)
  
  if (error) {
    console.error('❌ Supabase error:', error)
  } else {
    console.log('✅ Supabase connection successful!')
    console.log('Data sample:', data)
  }
} catch (err) {
  console.error('❌ Network/connection error:', err.message)
}