import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

// Get bot token from database settings
async function getBotToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single();
    
    if (error || !data) {
      console.log('No bot config found in settings');
      return null;
    }
    
    return data.value?.bot_token || null;
  } catch (error) {
    console.error('Error getting bot token:', error);
    return null;
  }
}

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
  const botToken = await getBotToken();
  if (!botToken) {
    console.error('Bot token not found in database');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telegram API error:', errorData);
    }
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
  }
}

async function linkEmployeeCode(employeeCode: string, chatId: number) {
  try {
    const { data, error } = await supabase.rpc('link_telegram_user', {
      p_employee_code: employeeCode,
      p_telegram_chat_id: chatId
    });

    return !error && data;
  } catch (error) {
    console.error('Error linking employee code:', error);
    return false;
  }
}

async function getEmployeeByTelegramId(chatId: number) {
  try {
    const { data, error } = await supabase.rpc('get_employee_by_telegram_id', {
      p_telegram_chat_id: chatId
    });

    if (error) {
      console.error('Error getting employee:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting employee:', error);
    return null;
  }
}

async function processOrderText(text: string, chatId: number, employeeCode: string) {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    
    let customerName = '';
    let customerPhone = '';
    let customerSecondaryPhone = '';
    let customerAddress = '';
    let items = [];
    let totalPrice = 0;
    let hasCustomPrice = false;
    let deliveryType = 'توصيل'; // افتراضي: توصيل
    let orderNotes = '';
    
    // الحصول على معلومات الموظف والإعدادات الافتراضية
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { p_telegram_chat_id: chatId });
    const employee = employeeData.data?.[0];
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('default_customer_name')
      .eq('user_id', employee?.user_id)
      .single();
    
    const defaultCustomerName = profileData?.default_customer_name || 'زبون من التليغرام';
    
    // الحصول على رسوم التوصيل الافتراضية
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single();
    
    const defaultDeliveryFee = settingsData?.value?.fee || 5000;

    let phoneFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // التحقق من نوع التسليم
      if (lowerLine.includes('محلي') || lowerLine.includes('تسليم محلي') || lowerLine.includes('استلام محلي')) {
        deliveryType = 'محلي';
        continue;
      }
      
      if (lowerLine.includes('توصيل') || lowerLine.includes('شحن') || lowerLine.includes('ديليفري')) {
        deliveryType = 'توصيل';
        continue;
      }
      
      // التحقق من الأرقام (10-11 رقم)
      const phoneRegex = /^0?\d{10,11}$/;
      if (phoneRegex.test(line.replace(/[\s-]/g, ''))) {
        const cleanPhone = line.replace(/[\s-]/g, '');
        if (!customerPhone) {
          customerPhone = cleanPhone;
          phoneFound = true;
        } else if (!customerSecondaryPhone) {
          customerSecondaryPhone = cleanPhone;
        }
        continue;
      }
      
      // التحقق من السعر
      const priceRegex = /([\d٠-٩]+)\s*([اﻻ]?لف|الف|ألف|k|K|000)?/;
      const priceMatch = line.match(priceRegex);
      if (priceMatch && (line.includes('الف') || line.includes('ألف') || line.includes('k') || line.includes('K') || /^\d+$/.test(line))) {
        let price = parseInt(priceMatch[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()));
        if (priceMatch[2]) {
          if (priceMatch[2].includes('ف') || priceMatch[2].includes('k') || priceMatch[2].includes('K')) {
            price *= 1000;
          }
        }
        totalPrice = price;
        hasCustomPrice = true;
        continue;
      }
      
      // التحقق من المنتجات (يدعم + للفصل)
      if (line.includes('+')) {
        const products = line.split('+').map(p => p.trim());
        for (const product of products) {
          if (product) {
            items.push(parseProduct(product));
          }
        }
        continue;
      }
      
      // التحقق من العنوان (كلمات تدل على المكان)
      const cityVariants = {
        'بغداد': ['بغداد', 'baghdad', 'بكداد'],
        'البصرة': ['بصرة', 'بصره', 'البصرة', 'البصره', 'basra', 'basrah'],
        'أربيل': ['أربيل', 'اربيل', 'erbil', 'hawler'],
        'الموصل': ['موصل', 'الموصل', 'mosul'],
        'كربلاء': ['كربلاء', 'كربلا', 'karbala'],
        'النجف': ['نجف', 'النجف', 'najaf'],
        'بابل': ['بابل', 'الحلة', 'babel', 'hilla'],
        'ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'nasiriyah'],
        'ديالى': ['ديالى', 'ديالا', 'بعقوبة', 'diyala'],
        'الأنبار': ['انبار', 'الانبار', 'الأنبار', 'الرمادي', 'anbar'],
        'صلاح الدين': ['صلاح الدين', 'تكريت', 'tikrit'],
        'واسط': ['واسط', 'الكوت', 'wasit'],
        'المثنى': ['مثنى', 'المثنى', 'السماوة', 'samawah'],
        'القادسية': ['قادسية', 'القادسية', 'الديوانية', 'diwaniyah'],
        'كركوك': ['كركوك', 'kirkuk'],
        'دهوك': ['دهوك', 'duhok'],
        'السليمانية': ['سليمانية', 'السليمانية', 'sulaymaniyah'],
        'ميسان': ['ميسان', 'العمارة', 'maysan']
      };
      
      let foundCity = false;
      for (const [city, variants] of Object.entries(cityVariants)) {
        for (const variant of variants) {
          if (lowerLine.includes(variant)) {
            customerAddress = line;
            deliveryType = 'توصيل'; // إذا ذكر عنوان فهو توصيل
            foundCity = true;
            break;
          }
        }
        if (foundCity) break;
      }
      
      // كلمات أخرى تدل على العنوان
      if (!foundCity && (lowerLine.includes('منطقة') || lowerLine.includes('شارع') || lowerLine.includes('حي') ||
          lowerLine.includes('محافظة') || lowerLine.includes('قضاء') || lowerLine.includes('ناحية') ||
          lowerLine.includes('مجمع') || lowerLine.includes('مدينة') || lowerLine.includes('قرية') ||
          lowerLine.includes('طريق') || lowerLine.includes('جسر') || lowerLine.includes('ساحة'))) {
        customerAddress = line;
        deliveryType = 'توصيل';
        foundCity = true;
      }
      
      if (foundCity) continue;
      
      // إذا لم يكن رقم أو سعر أو عنوان، فقد يكون اسم زبون أو منتج
      if (!phoneFound && i === 0 && !priceMatch && !line.includes('+')) {
        // السطر الأول اسم الزبون إذا لم نجد رقم بعد
        customerName = line;
        continue;
      }
      
      // وإلا فهو منتج أو ملاحظة
      if (line && !line.match(/^\d+/) && !priceMatch) {
        // قد يكون منتج أو ملاحظة
        const isProduct = line.match(/[a-zA-Z\u0600-\u06FF]{2,}/); // يحتوي على حروف
        if (isProduct) {
          items.push(parseProduct(line));
        } else {
          orderNotes += line + ' ';
        }
      }
    }
    
    // تعيين القيم الافتراضية
    if (!customerName) customerName = defaultCustomerName;
    
    // إذا لم يذكر عنوان وكان النوع توصيل، اجعله محلي
    if (!customerAddress && deliveryType === 'توصيل') {
      deliveryType = 'محلي';
    }
    
    // حساب السعر الافتراضي إذا لم يُحدد
    if (!hasCustomPrice && items.length > 0) {
      let calculatedPrice = 0;
      
      // جلب رسوم التوصيل الافتراضية من الإعدادات
      const { data: deliverySettings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'delivery_fee')
        .single();
      
      const currentDeliveryFee = deliverySettings?.value || 5000;
      
      for (const item of items) {
        // البحث في قاعدة البيانات عن المنتج
        const { data: productData } = await supabase
          .from('products')
          .select(`
            base_price,
            product_variants!inner (
              price,
              colors (name),
              sizes (name)
            )
          `)
          .ilike('name', `%${item.name}%`)
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (productData) {
          let productPrice = productData.base_price || 0;
          
          // البحث عن التنويع المطابق للون والمقاس
          if (productData.product_variants && productData.product_variants.length > 0) {
            const matchingVariant = productData.product_variants.find(variant => {
              const colorMatch = !item.color || variant.colors?.name?.toLowerCase().includes(item.color.toLowerCase());
              const sizeMatch = !item.size || variant.sizes?.name?.toLowerCase() === item.size.toLowerCase();
              return colorMatch && sizeMatch;
            });
            
            if (matchingVariant) {
              productPrice = matchingVariant.price || productPrice;
            } else if (productData.product_variants[0].price) {
              productPrice = productData.product_variants[0].price;
            }
          }
          
          // تحديث سعر المنتج في القائمة
          item.price = productPrice;
          calculatedPrice += productPrice * item.quantity;
        }
      }
      
      // إضافة رسوم التوصيل إذا كان توصيل
      if (deliveryType === 'توصيل') {
        calculatedPrice += currentDeliveryFee;
      }
      
      totalPrice = calculatedPrice;
    }

    // إنشاء الطلب الذكي
    const { data: orderId, error } = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        original_text: text,
        processed_at: new Date().toISOString(),
        telegram_user_id: chatId,
        employee_code: employeeCode,
        delivery_type: deliveryType,
        parsing_method: 'advanced_v2',
        items_count: items.length
      },
      p_customer_name: customerName,
      p_customer_phone: customerPhone || null,
      p_customer_address: customerAddress || (deliveryType === 'محلي' ? 'استلام محلي' : null),
      p_total_amount: totalPrice,
      p_items: items,
      p_telegram_chat_id: chatId,
      p_employee_code: employeeCode
    });

    console.log('Order creation result:', { orderId, error });

    if (error) {
      console.error('Error creating AI order:', error);
      return false;
    }

    // إرسال تأكيد مفصل
    const deliveryIcon = deliveryType === 'محلي' ? '🏪' : '🚚';
    const itemsList = items.slice(0, 3).map(item => 
      `• ${item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity}`
    ).join('\n');
    
    await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب بنجاح!</b>

🆔 <b>رقم الطلب:</b> <code>${orderId.toString().slice(-8)}</code>
👤 <b>الزبون:</b> ${customerName}
📱 <b>الهاتف:</b> ${customerPhone || 'غير محدد'}
${customerSecondaryPhone ? `📞 <b>هاتف ثانوي:</b> ${customerSecondaryPhone}` : ''}
${deliveryIcon} <b>نوع التسليم:</b> ${deliveryType}
${customerAddress ? `📍 <b>العنوان:</b> ${customerAddress}` : ''}
💰 <b>المبلغ الإجمالي:</b> ${totalPrice.toLocaleString()} د.ع

📦 <b>المنتجات (${items.length}):</b>
${itemsList}
${items.length > 3 ? `... و ${items.length - 3} منتجات أخرى` : ''}

⏳ <b>تم إرسال الطلب للمراجعة والموافقة</b>

<i>شكراً لك ${employee?.full_name}! 🙏</i>
    `);

    return orderId;
  } catch (error) {
    console.error('Error processing order:', error);
    return false;
  }
}

function parseProduct(productText: string) {
  const text = productText.trim();
  
  // استخراج الكمية
  let quantity = 1;
  const quantityMatch = text.match(/[×x*]\s*(\d+)|(\d+)\s*[×x*]/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
  }
  
  // استخراج المقاس
  let size = '';
  const sizeRegex = /\b(S|M|L|XL|XXL|s|m|l|xl|xxl|\d{2,3})\b/g;
  const sizeMatch = text.match(sizeRegex);
  if (sizeMatch) {
    size = sizeMatch[sizeMatch.length - 1].toUpperCase(); // آخر مقاس مذكور
  }
  
  // استخراج اللون
  const colors = ['أزرق', 'ازرق', 'blue', 'أصفر', 'اصفر', 'yellow', 'أحمر', 'احمر', 'red', 'أخضر', 'اخضر', 'green', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 'بني', 'brown', 'رمادي', 'gray', 'grey', 'بنفسجي', 'purple', 'وردي', 'pink'];
  let color = '';
  
  for (const c of colors) {
    if (text.toLowerCase().includes(c.toLowerCase())) {
      color = c;
      break;
    }
  }
  
  // استخراج اسم المنتج (إزالة الكمية والمقاس واللون)
  let productName = text
    .replace(/[×x*]\s*\d+|\d+\s*[×x*]/g, '')
    .replace(/\b(S|M|L|XL|XXL|s|m|l|xl|xxl|\d{2,3})\b/gi, '')
    .replace(/\b(أزرق|ازرق|blue|أصفر|اصفر|yellow|أحمر|احمر|red|أخضر|اخضر|green|أبيض|ابيض|white|أسود|اسود|black|بني|brown|رمادي|gray|grey|بنفسجي|purple|وردي|pink)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    name: productName || text,
    quantity: quantity,
    size: size,
    color: color,
    price: 0 // سيتم حسابه لاحقاً
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update, null, 2));

    if (!update.message || !update.message.text) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const userId = update.message.from.id;

    // التحقق من حالة المستخدم
    const employee = await getEmployeeByTelegramId(chatId);

    if (!employee) {
      // المستخدم غير مرتبط - التوجيه الذكي
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, `
🤖 <b>أهلاً وسهلاً بك في بوت RYUS للطلبات الذكية!</b>

🎯 <b>هذا البوت يساعدك في:</b>
• إرسال الطلبات مباشرة للنظام
• تلقي إشعارات فورية
• متابعة إحصائياتك اليومية
• التواصل السريع مع الإدارة

🔗 <b>لربط حسابك بالبوت:</b>
1️⃣ احصل على رمزك الخاص من موقع RYUS
2️⃣ أرسل الرمز هنا مباشرة
3️⃣ ستحصل على تأكيد فوري

📱 <b>كيفية الحصول على الرمز:</b>
• اذهب لموقع RYUS الخاص بك
• انقر على الإعدادات ⚙️
• اختر "بوت التليغرام" 
• انسخ رمزك (مثل: ABC1234)

💡 <b>الرمز يتكون من 7 أحرف/أرقام ويربطك بحسابك في النظام</b>

<i>أرسل رمزك الآن للبدء في استقبال الطلبات! 🚀</i>
        `);
        return new Response('OK', { status: 200 });
      }

      // محاولة ربط رمز الموظف
      if (text.length === 7 && /^[A-Z0-9]+$/i.test(text)) {
        const linked = await linkEmployeeCode(text.toUpperCase(), chatId);
        if (linked) {
          const newEmployee = await getEmployeeByTelegramId(chatId);
          const roleTitle = newEmployee?.role === 'admin' ? '👑 مدير' : 
                           newEmployee?.role === 'manager' ? '👨‍💼 مشرف' : '👤 موظف';
          
          await sendTelegramMessage(chatId, `
🎉 <b>تم ربط حسابك بنجاح!</b>

👋 أهلاً وسهلاً <b>${newEmployee?.full_name}</b>!
🎯 صلاحيتك: ${roleTitle}

🚀 <b>الآن يمكنك:</b>
• إرسال الطلبات وستتم معالجتها تلقائياً
• استلام إشعارات فورية للطلبات
• متابعة إحصائياتك اليومية
• الحصول على تقارير الأداء

📝 <b>كيفية إرسال طلب:</b>
<i>أحمد محمد - بغداد - الكرادة
قميص أبيض - كبير - 2  
بنطال أسود - متوسط - 1</i>

💡 <b>أوامر مفيدة:</b>
• /stats - عرض إحصائياتك
• /help - دليل الاستخدام الشامل
• أرسل أي رسالة أخرى كطلب

<b>🎊 مرحباً بك في فريق RYUS!</b>
          `);
        } else {
          await sendTelegramMessage(chatId, `
❌ <b>رمز الموظف غير صحيح</b>

🔍 <b>تأكد من:</b>
• الرمز صحيح ومن 7 أحرف/أرقام
• نسخ الرمز من إعدادات النظام
• عدم وجود مسافات إضافية

📱 <b>للحصول على رمزك:</b>
1. اذهب لموقع RYUS
2. إعدادات → بوت التليغرام  
3. انسخ رمزك بدقة

<i>جرب مرة أخرى أو تواصل مع الإدارة للمساعدة</i>
          `);
        }
      } else {
        await sendTelegramMessage(chatId, `
🔐 <b>يجب ربط حسابك أولاً</b>

أرسل رمز الموظف الخاص بك (7 أحرف/أرقام).

📱 <b>مثال صحيح:</b> ABC1234

💡 احصل على رمزك من إعدادات النظام في موقع RYUS
        `);
      }
      return new Response('OK', { status: 200 });
    }

    // User is linked - معالجة الأوامر حسب الصلاحية
    if (text === '/help') {
      const rolePermissions = {
        admin: {
          title: '👑 مدير النظام',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📊 مراجعة جميع الطلبات', 
            '💰 إدارة الأرباح والمحاسبة',
            '👥 إدارة الموظفين',
            '📦 إدارة المخزون الكامل',
            '🏪 إعدادات النظام'
          ]
        },
        manager: {
          title: '👨‍💼 مشرف',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📋 مراجعة طلبات الفريق',
            '📦 متابعة المخزون',
            '📊 تقارير الأداء',
            '💡 توجيه الموظفين'
          ]
        },
        employee: {
          title: '👤 موظف',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📊 متابعة طلباتك الشخصية',
            '📈 عرض إحصائياتك',
            '💼 إدارة عملائك'
          ]
        }
      };
      
      const userRole = rolePermissions[employee.role] || rolePermissions.employee;
      
      await sendTelegramMessage(chatId, `
📋 <b>المساعدة - نظام إدارة المخزون RYUS</b>

<b>🎯 مرحباً ${employee.full_name}</b>
<b>صلاحيتك:</b> ${userRole.title}

<b>📝 إنشاء طلب جديد:</b>
أرسل تفاصيل الطلب بالتنسيق التالي:
<i>اسم الزبون - المحافظة - العنوان التفصيلي
المنتج الأول - الحجم - الكمية
المنتج الثاني - الحجم - الكمية</i>

<b>🔧 الأوامر المتاحة:</b>
📊 /stats - عرض الإحصائيات
❓ /help - عرض هذه المساعدة

<b>🎯 صلاحياتك في النظام:</b>
${userRole.permissions.map(p => `• ${p}`).join('\n')}

<b>💡 مثال على طلب صحيح:</b>
<i>أحمد علي - بغداد - الكرادة شارع 14 بناية 5
قميص أبيض قطني - كبير - 2
بنطال جينز أزرق - متوسط - 1
حذاء رياضي - 42 - 1</i>

<b>📌 نصائح مهمة:</b>
• السطر الأول: معلومات الزبون والتوصيل
• باقي الأسطر: تفاصيل المنتجات
• استخدم أحجام واضحة ومفهومة
• اذكر اللون والنوع للوضوح

<b>🎊 نحن هنا لمساعدتك في تحقيق أفضل النتائج!</b>
      `);
      
    } else if (text === '/stats') {
      // Get user statistics from database
      const { data: orders } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('created_by', employee.employee_code);
        
      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const processedOrders = orders?.filter(o => o.status === 'processed').length || 0;
      
      // Calculate today's orders
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders?.filter(o => 
        o.created_at.startsWith(today)
      ).length || 0;
      
      // Calculate total value
      const totalValue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      const roleTitle = employee.role === 'admin' ? '👑 مدير' : 
                       employee.role === 'manager' ? '👨‍💼 مشرف' : '👤 موظف';
      
      await sendTelegramMessage(chatId, `
📊 <b>إحصائياتك - ${employee.full_name}</b>
<b>الصلاحية:</b> ${roleTitle}

📈 <b>ملخص الطلبات:</b>
📦 إجمالي الطلبات: <b>${totalOrders}</b>
📅 طلبات اليوم: <b>${todayOrders}</b>
⏳ قيد المراجعة: <b>${pendingOrders}</b>
✅ تم المعالجة: <b>${processedOrders}</b>

💰 <b>القيمة الإجمالية:</b> ${totalValue.toLocaleString()} دينار

${employee.role === 'admin' ? 
  `🔧 <b>أدوات المدير:</b>
• مراجعة جميع الطلبات في النظام
• إدارة المخزون والمنتجات  
• متابعة الأرباح والمحاسبة
• إدارة الموظفين وصلاحياتهم
• تقارير شاملة للنشاط` :
  employee.role === 'manager' ?
  `📋 <b>أدوات المشرف:</b>
• مراجعة طلبات الفريق
• متابعة أداء المخزون
• تقارير الأداء اليومية
• توجيه ومساعدة الموظفين` :
  `💼 <b>أدواتك كموظف:</b>
• إنشاء طلبات للعملاء
• متابعة حالة طلباتك
• عرض إحصائياتك الشخصية
• إدارة قاعدة عملائك`
}

<b>🎯 لإنشاء طلب جديد:</b>
أرسل تفاصيل الطلب مباشرة أو استخدم /help للمساعدة

<b>🚀 استمر في العمل الرائع!</b>
      `);
      
    } else {
      // Process order
      await processOrderText(text, chatId, employee.employee_code);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error in webhook:', error);
    return new Response('Error', { status: 500 });
  }
});