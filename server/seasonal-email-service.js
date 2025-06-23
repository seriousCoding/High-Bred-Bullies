// Seasonal Email Service - Automatically detects seasons and holidays for contextual email templates

class SeasonalEmailService {
  constructor() {
    this.currentDate = new Date();
  }

  // Get current season based on date
  getCurrentSeason() {
    const month = this.currentDate.getMonth() + 1; // 1-12
    const day = this.currentDate.getDate();

    if ((month === 12 && day >= 21) || (month <= 2) || (month === 3 && day < 20)) {
      return 'winter';
    } else if ((month === 3 && day >= 20) || (month <= 5) || (month === 6 && day < 21)) {
      return 'spring';
    } else if ((month === 6 && day >= 21) || (month <= 8) || (month === 9 && day < 22)) {
      return 'summer';
    } else {
      return 'autumn';
    }
  }

  // Detect current holidays and special occasions
  getCurrentHolidays() {
    const month = this.currentDate.getMonth() + 1;
    const day = this.currentDate.getDate();
    const holidays = [];

    // Holiday detection logic
    if (month === 1 && day === 1) holidays.push('new_year');
    if (month === 2 && day === 14) holidays.push('valentines');
    if (month === 3 && day === 17) holidays.push('st_patricks');
    if (month === 4 && this.isEaster()) holidays.push('easter');
    if (month === 5 && this.getLastMondayOfMay() === day) holidays.push('memorial_day');
    if (month === 7 && day === 4) holidays.push('independence_day');
    if (month === 9 && this.getFirstMondayOfSeptember() === day) holidays.push('labor_day');
    if (month === 10 && day === 31) holidays.push('halloween');
    if (month === 11 && this.getThanksgivingDay() === day) holidays.push('thanksgiving');
    if (month === 12 && day === 25) holidays.push('christmas');

    // Holiday seasons (extended periods)
    if (month === 12 && day >= 1) holidays.push('holiday_season');
    if (month === 1 && day <= 7) holidays.push('new_year_season');
    if (month === 10) holidays.push('halloween_season');
    if (month === 11) holidays.push('thanksgiving_season');

    return holidays;
  }

  // Helper methods for complex holiday calculations
  isEaster() {
    // Simplified Easter calculation for current year
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    // Easter typically falls in March or April
    return (month === 3 || month === 4);
  }

  getLastMondayOfMay() {
    const year = this.currentDate.getFullYear();
    const lastDay = new Date(year, 4, 31); // May 31st
    while (lastDay.getDay() !== 1) { // Find last Monday
      lastDay.setDate(lastDay.getDate() - 1);
    }
    return lastDay.getDate();
  }

  getFirstMondayOfSeptember() {
    const year = this.currentDate.getFullYear();
    const firstDay = new Date(year, 8, 1); // September 1st
    while (firstDay.getDay() !== 1) { // Find first Monday
      firstDay.setDate(firstDay.getDate() + 1);
    }
    return firstDay.getDate();
  }

  getThanksgivingDay() {
    const year = this.currentDate.getFullYear();
    const firstDay = new Date(year, 10, 1); // November 1st
    let thursdays = 0;
    while (thursdays < 4) {
      if (firstDay.getDay() === 4) thursdays++;
      if (thursdays < 4) firstDay.setDate(firstDay.getDate() + 1);
    }
    return firstDay.getDate();
  }

  // Get seasonal styling and themes
  getSeasonalTheme() {
    const season = this.getCurrentSeason();
    const holidays = this.getCurrentHolidays();

    const themes = {
      winter: {
        colors: { primary: '#1e3c72', secondary: '#2a5298', accent: '#667eea' },
        decorations: ['❄️', '🌨️', '⛄'],
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        message: 'Staying warm this winter season'
      },
      spring: {
        colors: { primary: '#56ab2f', secondary: '#a8e6cf', accent: '#88e5a3' },
        decorations: ['🌸', '🌷', '🦋'],
        background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
        message: 'Celebrating new beginnings this spring'
      },
      summer: {
        colors: { primary: '#ff7b7b', secondary: '#ffa726', accent: '#ffcc02' },
        decorations: ['☀️', '🌻', '🏖️'],
        background: 'linear-gradient(135deg, #ff7b7b 0%, #ffa726 100%)',
        message: 'Enjoying the sunny summer days'
      },
      autumn: {
        colors: { primary: '#d2691e', secondary: '#cd853f', accent: '#daa520' },
        decorations: ['🍂', '🍁', '🎃'],
        background: 'linear-gradient(135deg, #d2691e 0%, #cd853f 100%)',
        message: 'Embracing the beautiful autumn colors'
      }
    };

    let theme = themes[season];

    // Override with holiday-specific themes
    if (holidays.includes('christmas') || holidays.includes('holiday_season')) {
      theme = {
        colors: { primary: '#c41e3a', secondary: '#228b22', accent: '#ffd700' },
        decorations: ['🎄', '🎅', '🎁', '❄️'],
        background: 'linear-gradient(135deg, #c41e3a 0%, #228b22 100%)',
        message: 'Spreading holiday cheer to our beloved pet families'
      };
    } else if (holidays.includes('halloween') || holidays.includes('halloween_season')) {
      theme = {
        colors: { primary: '#ff4500', secondary: '#32174d', accent: '#ffa500' },
        decorations: ['🎃', '👻', '🦇'],
        background: 'linear-gradient(135deg, #ff4500 0%, #32174d 100%)',
        message: 'Having a spook-tacular time this Halloween season'
      };
    } else if (holidays.includes('thanksgiving') || holidays.includes('thanksgiving_season')) {
      theme = {
        colors: { primary: '#8b4513', secondary: '#daa520', accent: '#ff8c00' },
        decorations: ['🦃', '🍂', '🌽'],
        background: 'linear-gradient(135deg, #8b4513 0%, #daa520 100%)',
        message: 'Grateful for our amazing bulldog community this Thanksgiving'
      };
    }

    return theme;
  }

  // Generate seasonal email content
  generateWelcomeEmail(user, verificationLink) {
    const theme = this.getSeasonalTheme();
    const season = this.getCurrentSeason();
    const holidays = this.getCurrentHolidays();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to High Bred Bullies!</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: ${theme.background}; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
          .header { background: ${theme.background}; padding: 40px 30px; text-align: center; color: white; position: relative; }
          .header::before { content: '${theme.decorations[0]}'; position: absolute; top: 20px; left: 30px; font-size: 24px; opacity: 0.8; }
          .header::after { content: '${theme.decorations[1] || theme.decorations[0]}'; position: absolute; top: 20px; right: 30px; font-size: 24px; opacity: 0.8; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .seasonal-msg { font-size: 16px; opacity: 0.95; margin-top: 15px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 20px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 28px; color: ${theme.colors.primary}; margin-bottom: 25px; font-weight: 700; text-align: center; }
          .message { font-size: 16px; line-height: 1.7; color: #444; margin-bottom: 25px; }
          .welcome-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 15px; margin: 25px 0; border-left: 5px solid ${theme.colors.primary}; }
          .btn { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 18px; margin: 25px 0; box-shadow: 0 15px 25px rgba(40, 167, 69, 0.3); transition: transform 0.3s; }
          .btn:hover { transform: translateY(-3px); }
          .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
          .feature { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; }
          .feature-icon { font-size: 24px; margin-bottom: 10px; }
          .footer { background: #2c3e50; padding: 30px; text-align: center; color: white; }
          .paw-print { color: ${theme.colors.primary}; font-size: 20px; margin: 0 8px; }
          .decorations { position: absolute; color: white; opacity: 0.6; animation: float 3s infinite; }
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        </style>
      </head>
      <body>
        <div style="padding: 20px;">
          <div class="container">
            <div class="header">
              <div class="decorations" style="top: 10%; left: 20%;">${theme.decorations[2] || theme.decorations[0]}</div>
              <div class="decorations" style="top: 30%; right: 25%; animation-delay: 1s;">${theme.decorations[0]}</div>
              <div class="logo">🐕 High Bred Bullies</div>
              <p style="font-size: 18px; margin: 10px 0;">Premium American Bully Community</p>
              <div class="seasonal-msg">${theme.decorations[0]} ${theme.message}! ${theme.decorations[0]}</div>
            </div>
            
            <div class="content">
              <div class="greeting">Welcome to the Pack! 🐾</div>
              
              <div class="message">
                Hello ${user.first_name || 'New Member'},<br><br>
                
                We're absolutely thrilled to welcome you to High Bred Bullies, the premier community for American Bully enthusiasts! ${this.getSeasonalWelcomeMessage(season, holidays)}
              </div>
              
              <div class="welcome-box">
                <strong>${theme.decorations[0]} Your membership includes:</strong><br>
                • Access to premium breeding information<br>
                • Connect with fellow bulldog enthusiasts<br>
                • Browse available puppies from top breeders<br>
                • Educational resources and breeding guides<br>
                • Exclusive community events and updates
              </div>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="btn">Verify Your Email & Start Exploring! 🚀</a>
              </div>
              
              <div class="features">
                <div class="feature">
                  <div class="feature-icon">🏆</div>
                  <strong>Premium Genetics</strong><br>
                  <small>Champion bloodlines & health testing</small>
                </div>
                <div class="feature">
                  <div class="feature-icon">👥</div>
                  <strong>Expert Community</strong><br>
                  <small>Connect with experienced breeders</small>
                </div>
              </div>
              
              <div class="message">
                ${this.getSeasonalClosingMessage(season, holidays)}
              </div>
              
              <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin: 20px 0;">
                <strong>📧 Email Verification:</strong><br>
                Please verify your email address within 24 hours to unlock all community features. Don't worry - you can still browse and login without verification!
              </div>
            </div>
            
            <div class="footer">
              <p><strong>High Bred Bullies</strong> <span class="paw-print">🐾</span> Premium American Bully Community</p>
              <p>Building connections, one paw at a time</p>
              <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">${this.getSeasonalFooterMessage(season, holidays)}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePasswordResetEmail(user, resetLink) {
    const theme = this.getSeasonalTheme();
    const season = this.getCurrentSeason();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - High Bred Bullies</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: ${theme.background}; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
          .header { background: ${theme.background}; padding: 40px 30px; text-align: center; color: white; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .season-msg { font-size: 14px; opacity: 0.9; margin-top: 10px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 24px; color: ${theme.colors.primary}; margin-bottom: 20px; font-weight: 600; }
          .message { font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 30px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 10px 20px rgba(238, 90, 36, 0.3); transition: transform 0.2s; }
          .btn:hover { transform: translateY(-2px); }
          .security-note { background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .paw-print { color: ${theme.colors.primary}; font-size: 18px; margin: 0 5px; }
        </style>
      </head>
      <body>
        <div style="padding: 20px;">
          <div class="container">
            <div class="header">
              <div class="logo">🐕 High Bred Bullies</div>
              <p>Premium Bulldog Community</p>
              <div class="season-msg">${theme.message} ${theme.decorations[0]}</div>
            </div>
            
            <div class="content">
              <div class="greeting">Password Reset Request</div>
              
              <div class="message">
                Hello ${user.first_name || 'Fellow Dog Lover'},<br><br>
                
                We received a request to reset your password for your High Bred Bullies account. Just like our loyal bulldogs, we're here to help you get back on track!<br><br>
                
                Click the button below to create a new password and rejoin our amazing community of bulldog enthusiasts.
              </div>
              
              <div style="text-align: center;">
                <a href="${resetLink}" class="btn">Reset My Password 🔑</a>
              </div>
              
              <div class="security-note">
                <strong>🛡️ Security Notice:</strong><br>
                This link will expire in 1 hour for your security. If you didn't request this reset, please ignore this email - your account remains secure.
              </div>
              
              <div class="message">
                ${this.getSeasonalResetMessage(season)} <span class="paw-print">🐾</span>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>High Bred Bullies</strong> <span class="paw-print">🐾</span> Premium Bulldog Breeding Community</p>
              <p>Connecting bulldog lovers worldwide, one paw at a time</p>
              <p style="font-size: 12px; color: #999;">This email was sent because you requested a password reset. If this wasn't you, please contact our support team.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Seasonal message helpers
  getSeasonalWelcomeMessage(season, holidays) {
    if (holidays.includes('christmas') || holidays.includes('holiday_season')) {
      return 'Just like the holiday season brings families together, you\'ve now joined our special family of passionate bulldog lovers.';
    } else if (holidays.includes('thanksgiving')) {
      return 'This Thanksgiving season, we\'re especially grateful for new members like you who share our passion for these amazing dogs.';
    } else if (season === 'spring') {
      return 'Like the fresh blooms of spring, your journey with our bulldog community is just beginning!';
    } else if (season === 'summer') {
      return 'Summer is the perfect time to join our warm and welcoming bulldog family!';
    } else if (season === 'autumn') {
      return 'Like the beautiful autumn leaves, each new member adds unique color to our community!';
    } else {
      return 'During this cozy winter season, we\'re excited to welcome you to our warm community of bulldog enthusiasts!';
    }
  }

  getSeasonalClosingMessage(season, holidays) {
    if (holidays.includes('christmas') || holidays.includes('holiday_season')) {
      return 'During this magical holiday season, we\'re especially grateful for new members like you who share our passion for these amazing dogs. Your journey with High Bred Bullies starts now!';
    } else if (holidays.includes('thanksgiving')) {
      return 'This Thanksgiving, we\'re thankful for passionate members like you. We can\'t wait to see what amazing connections you\'ll make in our community!';
    } else {
      return 'We\'re excited to have you as part of our growing family of American Bully enthusiasts. Your adventure with High Bred Bullies begins today!';
    }
  }

  getSeasonalFooterMessage(season, holidays) {
    if (holidays.includes('christmas') || holidays.includes('holiday_season')) {
      return '🎄 Wishing you and your furry family a wonderful holiday season! 🎄';
    } else if (holidays.includes('thanksgiving')) {
      return '🦃 Grateful for amazing members like you this Thanksgiving! 🦃';
    } else if (holidays.includes('halloween')) {
      return '🎃 Have a spook-tacular time with your bulldogs this Halloween! 🎃';
    } else if (season === 'spring') {
      return '🌸 Enjoy the beautiful spring season with your furry friends! 🌸';
    } else if (season === 'summer') {
      return '☀️ Make the most of these sunny summer days with your bulldogs! ☀️';
    } else if (season === 'autumn') {
      return '🍂 Enjoy the crisp autumn weather with your four-legged companions! 🍂';
    } else {
      return '❄️ Stay warm and cozy with your beloved bulldogs this winter! ❄️';
    }
  }

  getSeasonalResetMessage(season) {
    if (season === 'winter') {
      return 'During this cozy winter season, we\'re grateful for amazing members like you who make our bulldog community so special.';
    } else if (season === 'spring') {
      return 'As spring brings new beginnings, we\'re here to help you get back into your account and reconnect with our community.';
    } else if (season === 'summer') {
      return 'Even during these bright summer days, we\'re here to help you access your account and stay connected with fellow bulldog lovers.';
    } else {
      return 'As the autumn leaves change, our commitment to helping our community members never wavers.';
    }
  }
}

module.exports = SeasonalEmailService;