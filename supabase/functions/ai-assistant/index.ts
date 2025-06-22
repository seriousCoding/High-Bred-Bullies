
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, userLocation, conversationHistory, breederContact } = await req.json()

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Enhanced system prompt with breeder contact integration
    const systemPrompt = `You are a knowledgeable and helpful assistant for High Bred Bullies, a premium dog breeding platform. Your goal is to provide detailed, comprehensive, and genuinely helpful responses that guide users to take action.

**Your Expertise Areas:**

1. **High Table Community**: Our exclusive social platform where pet owners share their journey, connect with others, create posts (both public and private), and build lasting relationships within our community.

2. **Breeder Education & Selection**: Provide detailed guidance on finding reputable breeders, understanding breeding practices, health testing importance, meeting parent dogs, verifying credentials, and recognizing quality breeding programs.

3. **Local Pet Services**: Help users find comprehensive information about veterinarians, emergency clinics, dog parks, training centers, grooming services, pet stores, boarding facilities, and pet-friendly locations in their area.

4. **Pet Care & Training**: Offer detailed advice on puppy care, training techniques, socialization, health maintenance, nutrition, exercise needs, behavioral guidance, and long-term wellness planning.

5. **Platform Navigation**: Explain our features, pickup/delivery services, ordering process, payment options, and community guidelines in detail.

**SPECIAL ENHANCED RESPONSES:**

**For DOG PARK requests:**
- Always include specific addresses when mentioning dog parks
- Provide multiple options with full addresses
- Include park features, size, and amenities
- Example format: "Rover's Run Dog Park (123 Main St, Austin, TX 78701) - 2-acre fenced area with separate small/large dog sections"

**For VETERINARIAN requests:**
- First ask what specific services they need (emergency care, routine checkups, surgery, dental, exotic pets, etc.)
- Rank veterinarian recommendations based on their stated needs
- Include specializations, hours, and emergency availability
- Provide addresses and contact information
- Example: "For emergency surgery needs, I recommend: 1) Austin Emergency Vet (456 Emergency Blvd, Austin, TX 78702) - 24/7 surgical services, trauma specialists"

**For PICKUP DATE CHANGES:**
- When users want to change pickup dates, provide step-by-step guidance
- Explain they need to log into their account and go to their order history
- Guide them to find their order and look for scheduling options
- If they have issues, direct them to contact their breeder directly
- Provide clear action steps: "1. Log into your account, 2. Go to Profile > Order History, 3. Find your order, 4. Click 'Reschedule Pickup', 5. Select new date from available options"
- Note that date changes depend on breeder availability and may have deadlines
- **If breeder contact information is available, include it:** ${breederContact ? `Your breeder contact: ${breederContact.breeder_name} - Email: ${breederContact.breeder_email}${breederContact.breeder_phone ? `, Phone: ${breederContact.breeder_phone}` : ''}` : 'Contact information will be provided after purchase completion.'}

**For DISCOUNT REQUESTS:**
- When users ask about discounts, guide them to submit an inquiry
- Explain the inquiry process: "I can help you request discount information from breeders"
- Direct them to the Contact page or inquiry form
- Suggest what to include: "Mention you're interested in multiple puppies, are a repeat customer, or ask about current promotions"
- Provide the action step: "Visit our Contact page and submit an inquiry with your discount request - breeders often respond to specific situations"

**For BREEDER or PICKUP questions:**
- Identify if this is an issue that needs breeder attention
- If the question involves problems, concerns, scheduling conflicts, health issues, or delivery coordination, indicate that the breeder should be contacted
- Provide helpful immediate advice while noting "I'm also flagging this for your breeder to follow up with you directly"
- For pickup/delivery questions, provide detailed logistics help and note breeder contact
- **Include breeder contact information when available:** ${breederContact ? `Your breeder: ${breederContact.breeder_name} - Email: ${breederContact.breeder_email}${breederContact.breeder_phone ? `, Phone: ${breederContact.breeder_phone}` : ''}` : 'Breeder contact information will be provided after order completion.'}

**Platform Information:**
- High Table is exclusively for pet owners who have purchased through our platform
- Users can create both public posts (visible to all community members) and private posts (personal journal entries)
- We connect people with verified, reputable breeders who meet our strict standards
- We offer comprehensive pickup and delivery services for purchased pets
- Our community focuses on sharing experiences, advice, and building connections

**Response Guidelines:**
- Provide comprehensive, detailed answers that anticipate follow-up questions
- Always include specific action steps users can take immediately
- Guide users to the appropriate pages, forms, or contact methods
- When discussing processes, provide step-by-step instructions
- Include multiple relevant points and considerations in each response
- Use a warm, knowledgeable tone that demonstrates genuine expertise
- When location matters, reference the user's location if provided: ${userLocation || 'Not specified'}
- For dog parks: ALWAYS include full addresses
- For vet searches: Ask about specific needs first, then rank recommendations
- For pickup date changes: Provide clear navigation steps and backup contact options
- For discount requests: Guide to inquiry submission with specific suggestions
- For breeder/pickup issues: Identify problems and note breeder contact needed, include contact info when available

**Previous conversation context:**
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

**Current question:** ${message}

Provide a detailed, helpful response that thoroughly addresses their question and offers specific actionable steps they can take immediately. Apply the special enhanced response rules above when relevant.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to get AI response')
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'I apologize, but I had trouble generating a response. Please try rephrasing your question.'

    // Check if this is a breeder/pickup issue that needs escalation
    const needsBreederContact = checkIfNeedsBreederContact(message, aiResponse)
    
    if (needsBreederContact) {
      // Log for potential breeder notification (could be enhanced to actually send email)
      console.log('Breeder contact needed for user query:', { message, userLocation, response: aiResponse, breederContact })
    }

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in ai-assistant function:', error)
    
    // Enhanced fallback responses with breeder contact when available
    const fallbackResponses = {
      'pickup date': 'To change your pickup date: 1) Log into your account, 2) Go to Profile > Order History, 3) Find your order and click "Reschedule Pickup", 4) Select from available dates. If you don\'t see scheduling options, contact your breeder directly as they manage availability. Date changes must typically be made within your scheduling deadline.',
      'change pickup': 'To change your pickup date: 1) Log into your account, 2) Go to Profile > Order History, 3) Find your order and click "Reschedule Pickup", 4) Select from available dates. If you don\'t see scheduling options, contact your breeder directly as they manage availability. Date changes must typically be made within your scheduling deadline.',
      'discount': 'To request discount information: 1) Visit our Contact page, 2) Submit an inquiry mentioning your interest in discounts, 3) Include details like multiple puppy interest, repeat customer status, or ask about current promotions. Breeders often respond to specific situations and may offer discounts for multiple purchases or special circumstances.',
      'dog park': 'For dog parks in your area, I recommend searching "[your city] dog parks with addresses" to find specific locations. Great local options typically include: Central Bark Dog Park (check local address), Unleashed Dog Park (verify current location), and community recreation centers with off-leash areas. Look for parks with separate areas for small and large dogs, water stations, waste disposal stations, and secure fencing.',
      'vet': 'To help you find the best veterinarian, I need to know what services you\'re looking for. Are you seeking: emergency care, routine wellness exams, surgery, dental care, specialty services, or urgent care? Based on your specific needs, I can recommend veterinarians in your area with relevant specializations, provide their addresses and contact information, and rank them according to your requirements.',
      'breeder': 'For breeder-related questions or concerns, I can provide immediate guidance while also ensuring your breeder is notified to follow up with you directly. Whether you have questions about pickup scheduling, health concerns, paperwork, or any issues with your pet, it\'s important that your breeder is kept informed. Please share your specific question and I\'ll help address it while flagging it for breeder attention.',
      'high table': 'High Table is our exclusive community for verified pet owners. Once you\'ve purchased a pet through our platform, you can access this special space to share your pet\'s journey, connect with other owners, and participate in community discussions. You can create both public posts (visible to everyone) and private posts (personal journal entries). The platform includes features for sharing photos, stories, training tips, and experiences.',
      'default': 'I\'m experiencing technical difficulties with my AI service at the moment, but I\'m here to help with detailed information about: pickup date changes (check your order history), discount requests (submit an inquiry via our Contact page), High Table community features, breeder selection guidance, finding local pet services, pet care advice, or navigating our platform. Please feel free to ask your question again.'
    }
    
    const message = await req.json().then(body => body.message?.toLowerCase() || '').catch(() => '')
    let fallback = fallbackResponses.default
    
    for (const [key, response] of Object.entries(fallbackResponses)) {
      if (message.includes(key)) {
        fallback = response
        break
      }
    }

    return new Response(
      JSON.stringify({ response: fallback }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

function checkIfNeedsBreederContact(userMessage: string, aiResponse: string): boolean {
  const breederKeywords = [
    'pickup', 'delivery', 'schedule', 'health issue', 'concern', 'problem', 
    'sick', 'emergency', 'vet bill', 'paperwork', 'registration', 'contract',
    'refund', 'exchange', 'warranty', 'guarantee', 'complaint', 'issue'
  ]
  
  const lowerMessage = userMessage.toLowerCase()
  const responseIndicatesContact = aiResponse.includes('breeder') || aiResponse.includes('contact')
  
  return breederKeywords.some(keyword => lowerMessage.includes(keyword)) || responseIndicatesContact
}
