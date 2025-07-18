import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  MessageCircle, Copy, Users, Bot, CheckCircle, AlertCircle, Smartphone, Settings 
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import TelegramBotSetup from './TelegramBotSetup';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { getUserSpecificTelegramCode, canViewAllData } = usePermissionBasedData();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchEmployeeCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_employee_codes')
        .select(`
          id,
          user_id,
          employee_code,
          is_active,
          telegram_chat_id,
          linked_at,
          created_at,
          updated_at,
          profiles!telegram_employee_codes_user_id_fkey(user_id, full_name, username, is_active)
        `)
        .eq('profiles.is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('خطأ في جلب الرموز:', error);
        // جربالاستعلام البديل
        const { data: altData, error: altError } = await supabase
          .from('telegram_employee_codes')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (altError) throw altError;
        
        // جلب بيانات الملفات الشخصية بشكل منفصل
        const userIds = altData.map(code => code.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, is_active')
          .in('user_id', userIds)
          .eq('is_active', true);
        
        if (profilesError) throw profilesError;
        
        // دمج البيانات
        const mergedData = altData.map(code => ({
          ...code,
          profiles: profilesData.find(profile => profile.user_id === code.user_id)
        })).filter(code => code.profiles);
        
        // تطبيق الفلترة بناءً على الصلاحيات - إظهار رمز المستخدم الحالي فقط إذا لم يكن مدير
        const filteredCodes = getUserSpecificTelegramCode(mergedData);
        setEmployeeCodes(filteredCodes);
        return;
      }
      
      // تطبيق الفلترة بناءً على الصلاحيات - إظهار رمز المستخدم الحالي فقط إذا لم يكن مدير
      const filteredCodes = getUserSpecificTelegramCode(data || []);
      setEmployeeCodes(filteredCodes);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب رموز الموظفين",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeCodes();
      checkBotConfiguration();
    }
  }, [open]);

  const checkBotConfiguration = async () => {
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'telegram_bot_config')
        .single();

      setBotConfigured(!!settings?.value?.bot_token && !!settings?.value?.auto_configured);
    } catch (error) {
      console.error('Error checking bot configuration:', error);
      setBotConfigured(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة",
      variant: "success"
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm max-h-[80vh] overflow-y-auto p-2 mx-auto"
        style={{ marginLeft: 'auto', marginRight: 'auto' }}>
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-sm">بوت التليغرام الذكي</h3>
              <p className="text-xs text-muted-foreground font-normal">رمزك الشخصي للاتصال مع بوت التليغرام</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Top Section - Bot Info */}
          <Card className="bg-accent/30 border-accent">
            <CardContent className="p-2">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="text-xs font-bold text-foreground">البوت نشط ويستقبل الطلبات تلقائياً من الموظفين</h3>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>🤖</span>
                    <span className="font-semibold text-xs">@Ryusiq_bot</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <p>✨ <strong>كل شيء تلقائي:</strong></p>
                    <div className="flex flex-wrap justify-center gap-1">
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">لا حاجة لإعداد يدوي</Badge>
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">الموظفين يحتاجون فقط لرموزهم</Badge>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1">
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">التوجيه الذكي داخل البوت</Badge>
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">دعم متقدم حسب الصلاحيات</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Codes Section */}
          <Card className="border-border">
            <CardHeader className="p-2 pb-1">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Users className="w-4 h-4 text-primary" />
                رموز الموظفين
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                {canViewAllData ? 'كل موظف له رمز للاتصال بالبوت' : 'رمزك الشخصي للاتصال بالبوت'}
              </p>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="space-y-1">
                {employeeCodes.map((employeeCode) => {
                  const profile = employeeCode.profiles;
                  const isCurrentUser = user?.user_id === employeeCode.user_id;
                  const isLinked = !!employeeCode.telegram_chat_id;
                  
                  return (
                    <div key={employeeCode.id} className={`p-2 rounded-lg border transition-colors ${
                      isCurrentUser 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-muted/50 border-border'
                    }`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                            isCurrentUser 
                              ? 'bg-primary' 
                              : 'bg-secondary-foreground'
                          }`}>
                            {profile?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate">{profile?.full_name || 'مستخدم غير معروف'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {isCurrentUser && (
                                <Badge variant="default" className="text-[8px] px-1 py-0">
                                  المدير العام
                                </Badge>
                              )}
                              <Badge 
                                variant={isLinked ? "default" : "outline"} 
                                className={`text-[8px] px-1 py-0 ${
                                  isLinked 
                                    ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' 
                                    : 'border-muted-foreground/50 text-muted-foreground'
                                }`}
                              >
                                {isLinked ? 'متصل' : 'غير متصل'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <Badge 
                            variant="outline" 
                            className={`font-mono text-[10px] px-1 py-1 flex-1 text-center ${
                              isCurrentUser 
                                ? 'bg-primary/20 text-primary border-primary/30' 
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {employeeCode.employee_code}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(employeeCode.employee_code)}
                            className="h-6 w-6 p-0 bg-background hover:bg-accent hover:text-accent-foreground flex-shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {employeeCodes.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {canViewAllData ? (
                      <>
                        <p className="text-xs font-semibold">لا يوجد موظفين مضافين بعد</p>
                        <p className="text-[10px]">أضف موظفين من إدارة الموظفين</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold">لم يتم إنشاء رمز تليجرام بعد</p>
                        <p className="text-[10px]">يرجى مراجعة المدير لإنشاء رمزك</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-accent/30 border-accent">
            <CardHeader className="p-2 pb-1">
              <CardTitle className="flex items-center gap-2 text-foreground text-xs">
                <Smartphone className="w-3 h-3" />
                كيفية الربط
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0">1</div>
                  <p className="text-[10px] text-muted-foreground">ابحث عن البوت في التليغرام واضغط <span className="font-semibold">Start</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0">2</div>
                  <p className="text-[10px] text-muted-foreground">أرسل الرمز الخاص بك إلى البوت</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0">3</div>
                  <p className="text-[10px] text-muted-foreground">ستتلقى رسالة تأكيد ربط الحساب</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0">4</div>
                  <p className="text-[10px] text-muted-foreground">ستبدأ بتلقي الإشعارات فوراً</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" className="text-xs h-7">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramBotDialog;