import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageCircle, Copy, Users, Bot, CheckCircle, AlertCircle, Smartphone, Settings,
  Plus, Trash2, Edit, Shield, User, Link, Unlink, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const TelegramManagementDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { canViewAllData } = usePermissionBasedData();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [newCodeValue, setNewCodeValue] = useState('');

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchEmployeeCodes = async () => {
    try {
      setIsLoading(true);
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
        
        // فلترة حسب الصلاحيات
        const filteredCodes = canViewAllData
          ? mergedData
          : mergedData.filter(code => code.user_id === user?.user_id);
        
        setEmployeeCodes(filteredCodes);
        return;
      }
      
      // فلترة حسب الصلاحيات
      const filteredCodes = canViewAllData
        ? data || []
        : (data || []).filter(code => code.user_id === user?.user_id);
      
      setEmployeeCodes(filteredCodes);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب رموز الموظفين",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // جلب جميع الموظفين للمديرين
  const fetchAllEmployees = async () => {
    if (!canViewAllData) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      
      setAllEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // إنشاء رمز جديد
  const generateNewCode = async (userId) => {
    try {
      const { data, error } = await supabase.rpc('generate_telegram_code', {
        user_id_input: userId,
        username_input: allEmployees.find(emp => emp.user_id === userId)?.username || 'USER'
      });

      if (error) throw error;

      toast({
        title: "تم إنشاء الرمز",
        description: `رمز التليجرام الجديد: ${data}`,
        variant: "success"
      });

      setShowAddForm(false);
      setSelectedEmployee('');
      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "خطأ في إنشاء الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // تحديث رمز موجود
  const updateEmployeeCode = async (codeId, newCode) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .update({ 
          employee_code: newCode,
          updated_at: new Date().toISOString(),
          telegram_chat_id: null, // إلغاء الربط عند تغيير الرمز
          linked_at: null
        })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم تحديث الرمز",
        description: "تم تحديث الرمز بنجاح - يجب إعادة ربط البوت",
        variant: "success"
      });

      setEditingCode(null);
      setNewCodeValue('');
      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error updating code:', error);
      toast({
        title: "خطأ في تحديث الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // حذف رمز
  const deleteEmployeeCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم حذف الرمز",
        description: "تم حذف رمز التليجرام بنجاح",
        variant: "success"
      });

      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: "خطأ في حذف الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // نسخ إلى الحافظة
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة",
      variant: "success"
    });
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeCodes();
      fetchAllEmployees();
    }
  }, [open, canViewAllData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[98vw] sm:max-h-[92vh] sm:p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold">إدارة بوت التليغرام الذكي</h3>
              <p className="text-sm text-muted-foreground font-normal">
                {canViewAllData ? 'إدارة كاملة لرموز جميع الموظفين' : 'عرض رمزك الشخصي'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* معلومات البوت */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-green-800">البوت نشط ويستقبل الطلبات تلقائياً</h3>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <span>🤖</span>
                    <span className="font-semibold">@Ryusiq_bot</span>
                  </div>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    نشط ومتصل
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* إدارة الرموز */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    رموز الموظفين
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {canViewAllData ? 'إدارة رموز جميع الموظفين' : 'رمزك الشخصي للاتصال بالبوت'}
                  </p>
                </div>
                {canViewAllData && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchEmployeeCodes()}
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      تحديث
                    </Button>
                    <Button 
                      onClick={() => setShowAddForm(true)}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة رمز
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* نموذج إضافة رمز جديد */}
              {showAddForm && canViewAllData && (
                <Card className="bg-blue-50 border-blue-200 mb-6">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">إنشاء رمز جديد</h4>
                    <div className="space-y-3">
                      <div>
                        <Label>اختر الموظف</Label>
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر موظف..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allEmployees
                              .filter(emp => !employeeCodes.some(code => code.user_id === emp.user_id))
                              .map(employee => (
                                <SelectItem key={employee.user_id} value={employee.user_id}>
                                  {employee.full_name} ({employee.username})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => generateNewCode(selectedEmployee)}
                          disabled={!selectedEmployee}
                          size="sm"
                        >
                          إنشاء الرمز
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowAddForm(false);
                            setSelectedEmployee('');
                          }}
                          size="sm"
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* قائمة الرموز */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-muted-foreground mt-2">جاري تحميل الرموز...</p>
                  </div>
                ) : employeeCodes.length > 0 ? (
                  employeeCodes.map((employeeCode) => {
                    const profile = employeeCode.profiles;
                    const isCurrentUser = user?.user_id === employeeCode.user_id;
                    const isLinked = !!employeeCode.telegram_chat_id;
                    const isEditing = editingCode === employeeCode.id;
                    
                    return (
                       <div key={employeeCode.id} className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                         isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                       }`}>
                         {/* Mobile Layout */}
                         <div className="sm:hidden space-y-3">
                           <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                               isCurrentUser 
                                 ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                                 : 'bg-gradient-to-r from-green-500 to-teal-500'
                             }`}>
                               {profile?.full_name?.charAt(0) || 'U'}
                             </div>
                             <div className="flex-1">
                               <p className="font-semibold text-sm">{profile?.full_name || 'مستخدم غير معروف'}</p>
                               <div className="flex gap-1 mt-1">
                                 {isCurrentUser && (
                                   <Badge variant="default" className="text-xs bg-blue-100 text-blue-700">
                                     {canViewAllData ? 'أنت (مدير)' : 'أنت'}
                                   </Badge>
                                 )}
                                 <Badge 
                                   variant={isLinked ? "default" : "outline"} 
                                   className={`text-xs ${isLinked ? 'bg-green-100 text-green-700' : ''}`}
                                 >
                                   {isLinked ? (
                                     <>
                                       <Link className="w-3 h-3 ml-1" />
                                       متصل
                                     </>
                                   ) : (
                                     <>
                                       <Unlink className="w-3 h-3 ml-1" />
                                       غير متصل
                                     </>
                                   )}
                                 </Badge>
                               </div>
                             </div>
                           </div>
                         </div>

                         {/* Desktop Layout */}
                         <div className="hidden sm:flex items-center justify-between">
                           <div className="flex items-center gap-3 flex-1 min-w-0">
                             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                               isCurrentUser 
                                 ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                                 : 'bg-gradient-to-r from-green-500 to-teal-500'
                             }`}>
                               {profile?.full_name?.charAt(0) || 'U'}
                             </div>
                             <div className="min-w-0 flex-1">
                               <p className="font-semibold text-lg truncate">{profile?.full_name || 'مستخدم غير معروف'}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 {isCurrentUser && (
                                   <Badge variant="default" className="text-xs bg-blue-100 text-blue-700">
                                     {canViewAllData ? 'أنت (مدير)' : 'أنت'}
                                   </Badge>
                                 )}
                                 <Badge 
                                   variant={isLinked ? "default" : "outline"} 
                                   className={`text-xs ${isLinked ? 'bg-green-100 text-green-700' : ''}`}
                                 >
                                   {isLinked ? (
                                     <>
                                       <Link className="w-3 h-3 ml-1" />
                                       متصل
                                     </>
                                   ) : (
                                     <>
                                       <Unlink className="w-3 h-3 ml-1" />
                                       غير متصل
                                     </>
                                   )}
                                 </Badge>
                               </div>
                             </div>
                           </div>
                         </div>
                          
                         {/* Code Actions */}
                         <div className={isEditing ? "space-y-3" : "flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-0"}>
                           {isEditing ? (
                             <div className="flex items-center gap-2">
                               <Input 
                                 value={newCodeValue}
                                 onChange={(e) => setNewCodeValue(e.target.value)}
                                 placeholder="الرمز الجديد"
                                 className="flex-1 text-sm"
                               />
                               <Button
                                 size="sm"
                                 onClick={() => updateEmployeeCode(employeeCode.id, newCodeValue)}
                                 disabled={!newCodeValue.trim()}
                                 className="text-xs px-2"
                               >
                                 حفظ
                               </Button>
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => {
                                   setEditingCode(null);
                                   setNewCodeValue('');
                                 }}
                                 className="text-xs px-2"
                               >
                                 إلغاء
                               </Button>
                             </div>
                           ) : (
                             <>
                                {/* Code Display */}
                                <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                                  <div className="flex-1 text-center sm:text-right">
                                    <Badge 
                                      variant="outline" 
                                      className={`font-mono text-sm sm:text-lg px-3 py-2 w-full sm:w-auto justify-center ${
                                         isCurrentUser 
                                           ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                           : 'bg-green-100 text-green-700 border-green-300'
                                       }`}
                                     >
                                       {employeeCode.employee_code}
                                     </Badge>
                                     <p className="text-xs text-muted-foreground mt-1 sm:hidden">الرمز</p>
                                   </div>

                                   {/* Action Buttons */}
                                   <div className="flex gap-2 w-full sm:w-auto justify-center">
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       onClick={() => copyToClipboard(employeeCode.employee_code)}
                                       className="flex-1 sm:flex-none"
                                     >
                                       <Copy className="w-4 h-4" />
                                       <span className="sm:hidden ml-2">نسخ</span>
                                     </Button>
                                     {canViewAllData && (
                                       <>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={() => {
                                             setEditingCode(employeeCode.id);
                                             setNewCodeValue(employeeCode.employee_code);
                                           }}
                                           className="flex-1 sm:flex-none"
                                         >
                                           <Edit className="w-4 h-4" />
                                           <span className="sm:hidden ml-2">تعديل</span>
                                         </Button>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={() => deleteEmployeeCode(employeeCode.id)}
                                           className="text-red-500 hover:text-red-700 flex-1 sm:flex-none"
                                         >
                                           <Trash2 className="w-4 h-4" />
                                           <span className="sm:hidden ml-2">حذف</span>
                                         </Button>
                                       </>
                                     )}
                                   </div>
                                 </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    {canViewAllData ? (
                      <>
                        <p className="text-lg font-semibold">لا يوجد رموز مضافة بعد</p>
                        <p className="text-sm">أضف رموز للموظفين من الزر أعلاه</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold">لم يتم إنشاء رمز تليجرام بعد</p>
                        <p className="text-sm">يرجى مراجعة المدير لإنشاء رمزك</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* تعليمات الاستخدام */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Smartphone className="w-5 h-5" />
                كيفية الربط والاستخدام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <p className="text-sm text-blue-700">ابحث عن البوت في التليغرام: <span className="font-mono">@Ryusiq_bot</span></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <p className="text-sm text-blue-700">اضغط على <span className="font-semibold">Start</span> وأرسل رمزك الشخصي</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <p className="text-sm text-blue-700">ستتلقى رسالة تأكيد ربط الحساب</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <p className="text-sm text-blue-700">يمكنك الآن إنشاء طلبات وتلقي إشعارات</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramManagementDialog;