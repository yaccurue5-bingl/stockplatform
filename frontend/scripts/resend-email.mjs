import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local manually
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Found' : 'Missing');
  process.exit(1);
}

async function resendConfirmationEmail(email) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log(`🔍 Searching for user: ${email}`);

    // 사용자 조회
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('❌ Error listing users:', userError);
      return;
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\n📋 Available users:');
      users.users.forEach(u => console.log(`   - ${u.email}`));
      return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes ✅' : 'No ❌'}`);
    console.log(`   Created at: ${new Date(user.created_at).toLocaleString()}`);

    if (user.email_confirmed_at) {
      console.log('\n⚠️  Email already confirmed at:', new Date(user.email_confirmed_at).toLocaleString());
      console.log('   No need to resend confirmation email.');
      return;
    }

    // 새 confirmation link 생성
    console.log('\n📧 Generating new confirmation link...');

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: 'https://k-marketinsight.com/auth/callback?type=signup'
      }
    });

    if (error) {
      console.error('❌ Error generating link:', error);
      return;
    }

    console.log('\n✅ Confirmation email sent successfully!');
    console.log('\n📧 Confirmation Details:');
    console.log(`   Email: ${email}`);
    console.log(`   Action Link: ${data.properties.action_link}`);
    console.log(`   Redirect To: https://k-marketinsight.com/auth/callback?type=signup`);
    console.log('\n⚠️  Note: Check spam folder if email is not received within 5 minutes.');
    console.log('\n🔗 Alternative: User can also click this link directly:');
    console.log(`   ${data.properties.action_link}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// 실행
const emailToResend = process.argv[2] || 'yaccurue3@naver.com';
console.log('🚀 K-MarketInsight Email Resend Tool\n');
resendConfirmationEmail(emailToResend);
