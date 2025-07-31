import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  FileText,
  Calendar,
  Filter,
  Eye,
  Download,
  BarChart3,
  PieChart,
  Target,
  Award,
  Crown,
  Coins,
  Package,
  ShoppingBag
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

const ManagerProfitsDialog = ({ 
  isOpen, 
  onClose, 
  orders = [], 
  employees = [], 
  calculateProfit,
  profits = [],
  managerId,
  stats: externalStats // الإحصائيات المحسوبة من الصفحة الرئيسية
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // تغيير الافتراضي لهذا الشهر
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  console.log('🔍 ManagerProfitsDialog Props DETAILED:', {
    isOpen,
    ordersCount: orders?.length || 0,
    employeesCount: employees?.length || 0,
    profitsCount: profits?.length || 0,
    calculateProfitExists: !!calculateProfit,
    ordersData: orders?.slice(0, 3)?.map(o => ({ 
      id: o.id, 
      number: o.order_number,
      status: o.status, 
      created_by: o.created_by,
      total: o.final_amount || o.total_amount,
      created_at: o.created_at
    })),
    employeesData: employees?.slice(0, 3)?.map(e => ({ 
      id: e.user_id, 
      name: e.full_name 
    })),
    profitsData: profits?.slice(0, 3)?.map(p => ({
      id: p.id,
      order_id: p.order_id,
      status: p.status,
      settled_at: p.settled_at
    }))
  });

  // تحقق فوري من البيانات
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    console.error('❌ ManagerProfitsDialog: لا توجد طلبات!', { orders });
  } else {
    console.log('✅ ManagerProfitsDialog: طلبات متوفرة', { count: orders.length });
  }

  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    console.error('❌ ManagerProfitsDialog: لا يوجد موظفين!', { employees });
  } else {
    console.log('✅ ManagerProfitsDialog: موظفين متوفرين', { count: employees.length });
  }

  if (!calculateProfit || typeof calculateProfit !== 'function') {
    console.error('❌ ManagerProfitsDialog: دالة حساب الأرباح غير متوفرة!', { calculateProfit });
  } else {
    console.log('✅ ManagerProfitsDialog: دالة حساب الأرباح متوفرة');
  }

  // فلترة البيانات حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date(now.setHours(23, 59, 59, 999)) };
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(now.setDate(weekStart.getDate() + 6));
        return { start: weekStart, end: weekEnd };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [selectedPeriod]);

  // حساب الأرباح المفصلة
  const detailedProfits = useMemo(() => {
    console.log('🚀 بدء معالجة detailedProfits - البيانات الخام:', {
      ordersCount: orders?.length || 0,
      employeesCount: employees?.length || 0,
      profitsCount: profits?.length || 0,
      hasCalculateProfit: !!calculateProfit,
      selectedPeriod,
      selectedEmployee,
      searchTerm,
      rawOrders: orders?.map(o => ({
        id: o.id,
        number: o.order_number,
        status: o.status,
        created_by: o.created_by,
        created_at: o.created_at
      }))
    });

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      console.log('❌ detailedProfits: لا توجد طلبات');
      return [];
    }

    console.log('🔄 معالجة الطلبات مع فلترة مبسطة:');

    const processed = orders
      .filter(order => {
        if (!order || !order.id) {
          console.log('❌ طلب فارغ أو بدون ID تم تجاهله');
          return false;
        }
        
        // فلترة التاريخ
        let withinPeriod = true;
        if (order.created_at && dateRange.start && dateRange.end) {
          const orderDate = new Date(order.created_at);
          if (!isNaN(orderDate.getTime())) {
            withinPeriod = orderDate >= dateRange.start && orderDate <= dateRange.end;
          }
        }
        
        // فلترة الحالة - أكثر مرونة
        const isValidStatus = ['delivered', 'completed', 'pending', 'processing'].includes(order.status);
        
        // فلترة الموظف
        const matchesEmployee = selectedEmployee === 'all' || order.created_by === selectedEmployee;
        
        // فلترة البحث
        const matchesSearch = !searchTerm || 
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const finalResult = withinPeriod && isValidStatus && matchesEmployee && matchesSearch;
        
        console.log(`🔍 فحص الطلب ${order.order_number || order.id} - تفصيلي:`, {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          created_by: order.created_by,
          selectedEmployee,
          searchTerm,
          withinPeriod,
          isValidStatus,
          matchesEmployee,
          matchesSearch,
          finalResult,
          orderDate: order.created_at,
          dateRange: { start: dateRange.start, end: dateRange.end }
        });
        
        return finalResult;
      })
      .map(order => {
        try {
          console.log(`💰 حساب ربح مفصل للطلب ${order.order_number}:`, {
            orderId: order.id,
            finalAmount: order.final_amount,
            totalAmount: order.total_amount,
            deliveryFee: order.delivery_fee,
            items: order.items?.length || 0
          });
          
          // حساب المبلغ بدون أجور التوصيل
          const totalWithDelivery = Number(order.final_amount || order.total_amount || 0);
          const deliveryFee = Number(order.delivery_fee || 0);
          const totalWithoutDelivery = Math.max(0, totalWithDelivery - deliveryFee);
          
          console.log(`📊 تفاصيل المبالغ للطلب ${order.order_number}:`, {
            totalWithDelivery,
            deliveryFee,
            totalWithoutDelivery
          });
          
          // حساب الربح بطريقة آمنة
          let managerProfit = 0;
          let employeeProfit = 0;
          let totalProfit = 0;
          let systemProfit = 0;

          if (calculateProfit && typeof calculateProfit === 'function') {
            try {
              // جرب استدعاء الدالة بطرق مختلفة
              let profitCalc;
              try {
                profitCalc = calculateProfit(order.id);
              } catch (e) {
                console.log('محاولة استدعاء بالطلب كاملاً...');
                profitCalc = calculateProfit(order);
              }
              
              console.log(`📊 نتيجة حساب الربح من الدالة للطلب ${order.order_number}:`, profitCalc);
              
              if (profitCalc && typeof profitCalc === 'object') {
                // استخراج قيم الربح من النتيجة
                systemProfit = Number(profitCalc.systemProfit || profitCalc.managerProfit || 0);
                employeeProfit = Number(profitCalc.employeeProfit || 0);
                totalProfit = Number(profitCalc.totalProfit || profitCalc.netProfit || (systemProfit + employeeProfit));
                managerProfit = systemProfit; // ربح المدير = ربح النظام
              } else if (typeof profitCalc === 'number') {
                // الدالة ترجع قيمة واحدة فقط
                totalProfit = Number(profitCalc || 0);
                systemProfit = totalProfit * 0.7; // 70% للنظام
                employeeProfit = totalProfit * 0.3; // 30% للموظف
                managerProfit = systemProfit;
              }
            } catch (error) {
              console.error(`❌ خطأ في تنفيذ دالة حساب الربح للطلب ${order.order_number}:`, error);
              // استخدم حساب يدوي عند الخطأ
              totalProfit = totalWithoutDelivery * 0.2; // افتراض 20% ربح
              systemProfit = totalProfit * 0.6; // 60% للنظام  
              employeeProfit = totalProfit * 0.4; // 40% للموظف
              managerProfit = systemProfit;
            }
          } else {
            // حساب الربح يدوياً باستخدام البيانات الحقيقية من النظام
            console.log(`🧮 حساب يدوي للأرباح للطلب ${order.order_number}:`, {
              totalWithoutDelivery,
              orderId: order.id,
              orderItems: order.items
            });
            
            // البحث عن بيانات الربح من جدول profits أولاً
            const profitRecord = profits?.find(p => p.order_id === order.id);
            
            console.log(`🔍 البحث عن ربح الطلب ${order.order_number}:`, {
              orderId: order.id,
              profitsArray: profits?.slice(0, 3)?.map(p => ({ order_id: p.order_id, profit_amount: p.profit_amount, employee_profit: p.employee_profit })),
              profitRecord,
              foundMatch: !!profitRecord
            });
            
            if (profitRecord) {
              // استخدام البيانات الحقيقية من جدول profits
              const totalProfitFromDB = Number(profitRecord.profit_amount || 0);
              const employeeProfitFromDB = Number(profitRecord.employee_profit || 0); 
              const managerProfitFromDB = totalProfitFromDB - employeeProfitFromDB;
              
              systemProfit = managerProfitFromDB;
              employeeProfit = employeeProfitFromDB; 
              totalProfit = totalProfitFromDB;
              managerProfit = managerProfitFromDB;
              
              console.log(`💎 استخدام بيانات الربح الحقيقية من قاعدة البيانات للطلب ${order.order_number}:`, {
                totalProfitFromDB,
                employeeProfitFromDB,
                managerProfitFromDB
              });
            } else if (calculateProfit && typeof calculateProfit === 'function') {
              // محاولة استخدام دالة حساب الأرباح للموظف
              try {
                const employeeProfitCalc = calculateProfit(order, order.created_by);
                if (typeof employeeProfitCalc === 'number') {
                  employeeProfit = Number(employeeProfitCalc || 0);
                  
                  // حساب إجمالي ربح الطلب
                  const totalCost = order.items?.reduce((sum, item) => {
                    const costPrice = item.cost_price || item.costPrice || 0;
                    const quantity = item.quantity || 0;
                    return sum + (costPrice * quantity);
                  }, 0) || 0;
                  
                  totalProfit = totalWithoutDelivery - totalCost;
                  systemProfit = totalProfit - employeeProfit;
                  managerProfit = systemProfit;
                  
                  console.log(`📋 حساب الأرباح باستخدام دالة calculateProfit للطلب ${order.order_number}:`, {
                    totalWithoutDelivery,
                    totalCost,
                    totalProfit,
                    employeeProfit: employeeProfitCalc,
                    systemProfit
                  });
                }
              } catch (calcError) {
                console.log('خطأ في دالة حساب الأرباح:', calcError);
              }
            }
            
            // إذا لم نحصل على أرباح حقيقية، استخدم حساب تقديري 
            if (systemProfit === 0 && employeeProfit === 0 && totalProfit === 0) {
              // حساب تقديري بناء على نسب واقعية
              totalProfit = totalWithoutDelivery * 0.15; // افتراض 15% ربح إجمالي
              systemProfit = totalProfit * 0.7; // 70% للنظام
              employeeProfit = totalProfit * 0.3; // 30% للموظف 
              managerProfit = systemProfit;
              
              console.log(`🧮 حساب تقديري (لا توجد بيانات ربح حقيقية):`, {
                totalWithoutDelivery,
                totalProfit,
                systemProfit,
                employeeProfit,
                managerProfit,
                profitPercentage: (totalProfit / totalWithoutDelivery * 100).toFixed(1)
              });
            }
          }
          
          const employee = employees.find(emp => emp.user_id === order.created_by);
          const profitStatus = profits.find(p => p.order_id === order.id);
          
          console.log(`✅ نتيجة نهائية للطلب ${order.order_number}:`, {
            totalWithoutDelivery,
            deliveryFee,
            managerProfit,
            employeeProfit,
            totalProfit,
            systemProfit,
            employee: employee?.full_name || 'غير معروف',
            profitStatus: profitStatus?.status || 'غير معروف'
          });
          
          return {
            ...order,
            employee,
            // استخدام المبلغ بدون التوصيل
            orderTotal: totalWithoutDelivery,
            deliveryFee: deliveryFee,
            totalWithDelivery: totalWithDelivery,
            managerProfit: Math.round(managerProfit),
            employeeProfit: Math.round(employeeProfit),
            totalProfit: Math.round(totalProfit),
            systemProfit: Math.round(systemProfit),
            profitPercentage: totalWithoutDelivery > 0 ? ((totalProfit / totalWithoutDelivery) * 100).toFixed(1) : '0',
            isPaid: profitStatus?.status === 'settled' || profitStatus?.settled_at,
            settledAt: profitStatus?.settled_at,
            items: order.items || []
          };
        } catch (error) {
          console.error('❌ خطأ في حساب الربح للطلب:', order.id, error);
          return null;
        }
      })
      .filter(order => {
        const isValid = order !== null;
        // إزالة شرط وجود الأرباح لضمان عرض كل الطلبات المعالجة
        
        console.log(`🔎 فحص صحة الطلب ${order?.order_number}:`, {
          isValid,
          managerProfit: order?.managerProfit,
          employeeProfit: order?.employeeProfit,
          totalProfit: order?.totalProfit,
          shouldInclude: isValid
        });
        
        return isValid; // عرض كل الطلبات الصالحة بغض النظر عن وجود أرباح
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('✅ الطلبات المعالجة النهائية:', {
      processedCount: processed.length,
      totalManagerProfit: processed.reduce((sum, order) => sum + order.managerProfit, 0)
    });

    return processed;
  }, [orders, dateRange, selectedEmployee, searchTerm, calculateProfit, employees, profits]);

  // إحصائيات شاملة - استخدم الإحصائيات الخارجية إذا كانت متوفرة
  const stats = useMemo(() => {
    // إذا كانت الإحصائيات متوفرة من الصفحة الرئيسية، استخدمها
    if (externalStats && typeof externalStats === 'object') {
      console.log('📊 استخدام الإحصائيات من الصفحة الرئيسية:', externalStats);
      return {
        totalManagerProfit: externalStats.totalManagerProfits || 0,
        totalEmployeeProfit: 0, // سيتم حسابها من detailedProfits
        totalRevenue: externalStats.totalSales || 0,
        pendingProfit: externalStats.pendingDues || 0,
        settledProfit: externalStats.paidDues || 0,
        totalOrders: externalStats.totalOrders || 0,
        averageOrderValue: externalStats.totalOrders > 0 ? (externalStats.totalSales / externalStats.totalOrders) : 0,
        profitMargin: externalStats.totalSales > 0 ? ((externalStats.totalManagerProfits / externalStats.totalSales) * 100).toFixed(1) : '0.0',
        topEmployees: [] // سيتم حسابها من detailedProfits
      };
    }

    // إذا لم تكن متوفرة، احسبها من detailedProfits
    if (!detailedProfits || !Array.isArray(detailedProfits)) {
      console.log('❌ stats: لا توجد أرباح مفصلة ولا إحصائيات خارجية');
      return {
        totalManagerProfit: 0,
        totalEmployeeProfit: 0,
        totalRevenue: 0,
        pendingProfit: 0,
        settledProfit: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        profitMargin: '0.0',
        topEmployees: []
      };
    }

    const totalManagerProfit = detailedProfits.reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    const totalEmployeeProfit = detailedProfits.reduce((sum, order) => sum + (Number(order.employeeProfit) || 0), 0);
    // استخدام المبلغ بدون أجور التوصيل للإحصائيات
    const totalRevenue = detailedProfits.reduce((sum, order) => sum + (Number(order.orderTotal) || 0), 0);
    const pendingProfit = detailedProfits.filter(order => !order.isPaid).reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    const settledProfit = detailedProfits.filter(order => order.isPaid).reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    
    const employeeStats = {};
    detailedProfits.forEach(order => {
      if (!employeeStats[order.created_by]) {
        employeeStats[order.created_by] = {
          employee: order.employee,
          orders: 0,
          managerProfit: 0,
          employeeProfit: 0,
          revenue: 0
        };
      }
      employeeStats[order.created_by].orders += 1;
      employeeStats[order.created_by].managerProfit += Number(order.managerProfit) || 0;
      employeeStats[order.created_by].employeeProfit += Number(order.employeeProfit) || 0;
      // استخدام المبلغ بدون أجور التوصيل
      employeeStats[order.created_by].revenue += Number(order.orderTotal) || 0;
    });

    const calculatedStats = {
      totalManagerProfit,
      totalEmployeeProfit,
      totalRevenue,
      pendingProfit,
      settledProfit,
      totalOrders: detailedProfits.length,
      averageOrderValue: detailedProfits.length > 0 ? totalRevenue / detailedProfits.length : 0,
      profitMargin: totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      topEmployees: Object.values(employeeStats)
        .sort((a, b) => (b.managerProfit || 0) - (a.managerProfit || 0))
        .slice(0, 5)
    };

    console.log('📊 الإحصائيات المحسوبة داخلياً:', calculatedStats);

    return calculatedStats;
  }, [detailedProfits, externalStats]);

  const formatCurrency = (amount) => {
    return `${(Number(amount) || 0).toLocaleString()} د.ع`;
  };

  const StatCard = ({ title, value, icon: Icon, gradient, percentage }) => (
    <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-border/30 h-32">
      <CardContent className="p-0 h-full">
        <div className={`text-center space-y-2 bg-gradient-to-br ${gradient} text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between`}>
          {/* الأيقونة والعنوان */}
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-white/90">{title}</p>
          </div>
          
          {/* القيمة */}
          <div className="text-center">
            <p className="text-lg font-bold text-white leading-tight">
              {typeof value === 'number' ? formatCurrency(value) : value}
            </p>
          </div>
          
          {/* نسبة مئوية إن وجدت */}
          {percentage && !isNaN(parseFloat(percentage)) && (
            <div className="pt-1 border-t border-white/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/80">النسبة</span>
                <span className="text-xs font-bold text-white">{percentage}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1">
                <div 
                  className="bg-white rounded-full h-1 transition-all duration-1000"
                  style={{ width: `${Math.min(parseFloat(percentage) || 0, 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* تأثيرات الخلفية */}
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white/10 rounded-full"></div>
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-white/10 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );

  const EmployeeCard = ({ employeeData }) => {
    // البحث عن فواتير الموظف المدفوعة مع التفاصيل الكاملة
    const employeeInvoices = profits?.filter(p => 
      p.employee_id === employeeData.employee?.user_id && 
      (p.status === 'settled' || p.status === 'invoice_received' || p.settled_at)
    ) || [];

    console.log(`🧾 فواتير الموظف ${employeeData.employee?.full_name}:`, {
      employeeId: employeeData.employee?.user_id,
      invoicesCount: employeeInvoices.length,
      invoices: employeeInvoices
    });

    const [showInvoices, setShowInvoices] = useState(false);

    return (
      <Card className="relative overflow-hidden bg-gradient-to-br from-background to-muted/10 border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-2 group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {employeeData.orders}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">{employeeData.employee?.full_name || 'غير محدد'}</h3>
                <p className="text-xs text-muted-foreground font-medium">{employeeData.orders} طلب مكتمل</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-green-600 mb-1">{formatCurrency(employeeData.managerProfit)}</p>
              <Badge variant="secondary" className="text-xs">ربحي منه</Badge>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-center">
                <p className="text-sm font-bold text-blue-600">{formatCurrency(employeeData.revenue)}</p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي المبيعات</p>
              </div>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-center">
                <p className="text-sm font-bold text-purple-600">{formatCurrency(employeeData.employeeProfit)}</p>
                <p className="text-xs text-muted-foreground font-medium">ربح الموظف</p>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-muted-foreground">نسبة المساهمة</span>
                <span className="text-xs font-bold text-primary">
                  {stats.totalManagerProfit > 0 ? ((employeeData.managerProfit / stats.totalManagerProfit) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <Progress 
                value={stats.totalManagerProfit > 0 ? (employeeData.managerProfit / stats.totalManagerProfit) * 100 : 0} 
                className="h-2" 
              />
            </div>

            {/* قسم فواتير المستحقات */}
            <div className="pt-3 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    فواتير المستحقات ({employeeInvoices.length})
                  </span>
                </div>
                {employeeInvoices.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={() => setShowInvoices(!showInvoices)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {showInvoices && employeeInvoices.length > 0 ? (
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {employeeInvoices.map((invoice, idx) => (
                      <div key={invoice.id || idx} className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-green-700 text-sm">طلب #{invoice.order_id?.slice(-4) || 'غير محدد'}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.settled_at ? format(new Date(invoice.settled_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : 'غير محدد'}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-700 text-xs">
                            {invoice.status === 'settled' ? 'مسوى' : invoice.status === 'invoice_received' ? 'مستلم' : 'مدفوع'}
                          </Badge>
                        </div>
                        
                        {/* تفاصيل الفاتورة */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white dark:bg-gray-800 p-2 rounded">
                            <p className="text-muted-foreground">إجمالي الربح</p>
                            <p className="font-bold text-green-600">{formatCurrency(invoice.profit_amount || 0)}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded">
                            <p className="text-muted-foreground">ربح الموظف</p>
                            <p className="font-bold text-purple-600">{formatCurrency(invoice.employee_profit || 0)}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded">
                            <p className="text-muted-foreground">إجمالي الإيرادات</p>
                            <p className="font-bold text-blue-600">{formatCurrency(invoice.total_revenue || 0)}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded">
                            <p className="text-muted-foreground">التكلفة</p>
                            <p className="font-bold text-orange-600">{formatCurrency(invoice.total_cost || 0)}</p>
                          </div>
                        </div>
                        
                        {/* نسبة الموظف */}
                        {invoice.employee_percentage && (
                          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">نسبة الموظف</span>
                              <span className="font-bold text-purple-600">{Number(invoice.employee_percentage).toFixed(1)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {employeeInvoices.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{employeeInvoices.length - 3} فاتورة أخرى
                      </p>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                employeeInvoices.length === 0 && (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground">لا توجد فواتير مدفوعة</p>
                  </div>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const OrderCard = ({ order }) => (
    <Card className="relative overflow-hidden bg-gradient-to-br from-background to-muted/5 border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="p-3 relative z-10">
        {/* Header - مضغوط */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                order.isPaid 
                  ? 'bg-gradient-to-br from-green-500 to-green-600' 
                  : 'bg-gradient-to-br from-yellow-500 to-orange-500'
              }`}>
                {order.isPaid ? (
                  <CheckCircle className="h-4 w-4 text-white" />
                ) : (
                  <Clock className="h-4 w-4 text-white" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-foreground truncate">{order.order_number}</h4>
              <p className="text-xs text-muted-foreground truncate">{order.customer_name || 'عميل غير محدد'}</p>
            </div>
          </div>
          <div className="text-left">
            <Badge variant={order.isPaid ? "default" : "secondary"} className="text-xs px-2 py-1">
              {order.isPaid ? 'مدفوع' : 'معلق'}
            </Badge>
          </div>
        </div>
        
        {/* Main Stats - 2x2 Grid مضغوط */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
            <p className="text-sm font-bold text-blue-600">{formatCurrency(order.orderTotal || order.totalWithoutDelivery || order.final_amount || order.total_amount || 0)}</p>
            <p className="text-xs text-muted-foreground">الطلب</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
            <p className="text-sm font-bold text-green-600">{formatCurrency(order.managerProfit || order.systemProfit || 0)}</p>
            <p className="text-xs text-muted-foreground">ربحي</p>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-center">
            <p className="text-sm font-bold text-purple-600">{formatCurrency(order.employeeProfit || 0)}</p>
            <p className="text-xs text-muted-foreground">ربح الموظف</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-center">
            <p className="text-sm font-bold text-orange-600">{order.profitPercentage || '0'}%</p>
            <p className="text-xs text-muted-foreground">هامش الربح</p>
          </div>
        </div>

        {/* Employee & Date - مضغوط */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{order.employee?.full_name || order.employeeName || 'موظف غير محدد'}</span>
          <span>{format(new Date(order.created_at), 'dd/MM', { locale: ar })}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden p-0">
        <div className="bg-gradient-to-br from-background via-background to-muted/10 border-0 shadow-xl rounded-xl overflow-hidden">
          <DialogHeader className="bg-gradient-to-l from-primary/5 via-primary/3 to-transparent p-4 border-b border-border/30">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 shadow-md">
                <Crown className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">تفاصيل أرباحي من الموظفين</h2>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  إجمالي الأرباح: {formatCurrency(stats.totalManagerProfit || 0)} • {stats.totalOrders || 0} طلب
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary font-bold px-3 py-1">
                {formatCurrency(stats.totalManagerProfit || 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* التحقق من وجود البيانات */}
            {!orders || !Array.isArray(orders) || orders.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
                <p className="text-muted-foreground">لا توجد طلبات متاحة لعرض الأرباح</p>
              </div>
            ) : !employees || employees.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">لا يوجد موظفين</h3>
                <p className="text-muted-foreground">لا يوجد موظفين متاحين لعرض أرباحهم</p>
              </div>
            ) : (
              <>
            {/* الفلاتر */}
            <Card className="border border-border/30 bg-gradient-to-br from-muted/20 to-muted/5 shadow-md">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      الفترة الزمنية
                    </label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">اليوم</SelectItem>
                        <SelectItem value="week">هذا الأسبوع</SelectItem>
                        <SelectItem value="month">هذا الشهر</SelectItem>
                        <SelectItem value="year">هذا العام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      الموظف
                    </label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الموظفين</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.full_name || emp.name || 'غير محدد'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      البحث
                    </label>
                    <Input
                      placeholder="رقم الطلب أو اسم العميل..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button variant="outline" className="w-full bg-background/80 hover:bg-primary/10 border-border/50 hover:border-primary/50 transition-all">
                      <Download className="h-4 w-4 mr-2" />
                      تصدير التقرير
                    </Button>
                  </div>
                </div>
              </CardContent>
          </Card>

          {/* الإحصائيات الرئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي أرباحي"
              value={stats.totalManagerProfit || 0}
              icon={Crown}
              gradient="from-yellow-500 to-orange-600"
            />
            <StatCard
              title="الأرباح المعلقة"
              value={stats.pendingProfit || 0}
              icon={Clock}
              gradient="from-orange-500 to-red-600"
              percentage={stats.totalManagerProfit > 0 ? (((stats.pendingProfit || 0) / stats.totalManagerProfit) * 100).toFixed(1) : '0'}
            />
            <StatCard
              title="الأرباح المدفوعة"
              value={stats.settledProfit || 0}
              icon={CheckCircle}
              gradient="from-emerald-500 to-teal-600"
              percentage={stats.totalManagerProfit > 0 ? (((stats.settledProfit || 0) / stats.totalManagerProfit) * 100).toFixed(1) : '0'}
            />
            <StatCard
              title="هامش الربح"
              value={`${stats.profitMargin || '0.0'}%`}
              icon={TrendingUp}
              gradient="from-blue-500 to-purple-600"
            />
          </div>

          {/* التبويبات */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="employees">تفاصيل الموظفين</TabsTrigger>
              <TabsTrigger value="orders">تفاصيل الطلبات</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* أفضل الموظفين */}
                <Card className="h-80">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-5 w-5" />
                      أفضل الموظفين (حسب أرباحي منهم)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-60">
                      <div className="space-y-2">
                        {stats.topEmployees.length > 0 ? (
                          stats.topEmployees.map((emp, idx) => (
                            <div key={emp.employee?.user_id || idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                                  idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-500' : 'bg-blue-500'
                                }`}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{emp.employee?.full_name || 'غير محدد'}</p>
                                  <p className="text-xs text-muted-foreground">{emp.orders} طلب</p>
                                </div>
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-green-600 text-sm">{formatCurrency(emp.managerProfit)}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(emp.revenue)} مبيعات</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">لا توجد بيانات موظفين</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* الإحصائيات التفصيلية */}
                <Card className="h-80">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5" />
                      تحليل مفصل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-xl font-bold text-blue-600">{stats.totalOrders}</p>
                        <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(stats.averageOrderValue)}</p>
                        <p className="text-xs text-muted-foreground">متوسط قيمة الطلب</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">إجمالي الإيرادات</span>
                        <span className="font-medium text-sm">{formatCurrency(stats.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">أرباح الموظفين</span>
                        <span className="font-medium text-blue-600 text-sm">{formatCurrency(stats.totalEmployeeProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">أرباحي الإجمالية</span>
                        <span className="font-medium text-green-600 text-sm">{formatCurrency(stats.totalManagerProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">هامش الربح</span>
                        <span className="font-medium text-purple-600 text-sm">{stats.profitMargin}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employees" className="space-y-4">
              {/* إضافة معالجة بديلة للموظفين من البيانات المفصلة */}
              {(() => {
                // حساب بيانات الموظفين من detailedProfits مباشرة
                const employeeStats = {};
                detailedProfits.forEach(order => {
                  const employeeId = order.created_by;
                  if (!employeeStats[employeeId]) {
                    employeeStats[employeeId] = {
                      employee: order.employee || { user_id: employeeId, full_name: order.employeeName || 'موظف غير محدد' },
                      orders: 0,
                      managerProfit: 0,
                      employeeProfit: 0,
                      revenue: 0
                    };
                  }
                  employeeStats[employeeId].orders += 1;
                  employeeStats[employeeId].managerProfit += Number(order.managerProfit) || 0;
                  employeeStats[employeeId].employeeProfit += Number(order.employeeProfit) || 0;
                  employeeStats[employeeId].revenue += Number(order.orderTotal) || 0;
                });

                const employeeList = Object.values(employeeStats)
                  .sort((a, b) => (b.managerProfit || 0) - (a.managerProfit || 0))
                  .slice(0, 10);

                console.log('🧑‍💼 إحصائيات الموظفين المحسوبة:', employeeList);

                return employeeList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employeeList.map((empData, idx) => (
                      <EmployeeCard key={empData.employee?.user_id || idx} employeeData={empData} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                      <Users className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد بيانات موظفين</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      لا توجد بيانات أرباح للموظفين في الفترة المحددة
                    </p>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {detailedProfits.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {detailedProfits.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    لا توجد طلبات مطابقة للفلاتر المحددة في الفترة الزمنية المختارة
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={() => {
                      setSelectedPeriod('year');
                      setSelectedEmployee('all');
                      setSearchTerm('');
                    }}
                  >
                    إعادة تعيين الفلاتر
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerProfitsDialog;