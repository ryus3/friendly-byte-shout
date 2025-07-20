import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const useCashSources = () => {
  const [cashSources, setCashSources] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب مصادر النقد
  const fetchCashSources = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_sources')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      setCashSources(data || []);
    } catch (error) {
      console.error('خطأ في جلب مصادر النقد:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات مصادر النقد",
        variant: "destructive"
      });
    }
  };

  // جلب حركات النقد
  const fetchCashMovements = async (sourceId = null, limit = 50) => {
    try {
      let query = supabase
        .from('cash_movements')
        .select(`
          *,
          cash_sources (name, type)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sourceId) {
        query = query.eq('cash_source_id', sourceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCashMovements(data || []);
    } catch (error) {
      console.error('خطأ في جلب حركات النقد:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب حركات النقد",
        variant: "destructive"
      });
    }
  };

  // إضافة مصدر نقد جديد
  const addCashSource = async (sourceData) => {
    try {
      const { data, error } = await supabase
        .from('cash_sources')
        .insert([{
          ...sourceData,
          current_balance: sourceData.initial_balance || 0,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      // إضافة حركة افتتاحية إذا كان هناك رصيد ابتدائي
      if (sourceData.initial_balance > 0) {
        await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: data.id,
          p_amount: sourceData.initial_balance,
          p_movement_type: 'in',
          p_reference_type: 'capital_injection',
          p_reference_id: null,
          p_description: `رصيد افتتاحي لمصدر النقد: ${data.name}`,
          p_created_by: (await supabase.auth.getUser()).data.user?.id
        });
      }

      setCashSources(prev => [...prev, data]);
      toast({
        title: "تم بنجاح",
        description: "تم إضافة مصدر النقد الجديد"
      });

      return { success: true, data };
    } catch (error) {
      console.error('خطأ في إضافة مصدر النقد:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة مصدر النقد",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // إضافة أموال لمصدر نقد
  const addCashToSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { data, error } = await supabase.rpc('update_cash_source_balance', {
        p_cash_source_id: sourceId,
        p_amount: amount,
        p_movement_type: 'in',
        p_reference_type: 'capital_injection',
        p_reference_id: null,
        p_description: description || 'إضافة أموال للقاصة',
        p_created_by: user.id
      });

      if (error) throw error;

      // تحديث البيانات
      await fetchCashSources();
      await fetchCashMovements();

      toast({
        title: "تم بنجاح",
        description: `تم إضافة ${amount.toLocaleString()} د.ع للقاصة`
      });

      return { success: true };
    } catch (error) {
      console.error('خطأ في إضافة الأموال:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة الأموال",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // سحب أموال من مصدر نقد
  const withdrawCashFromSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { data, error } = await supabase.rpc('update_cash_source_balance', {
        p_cash_source_id: sourceId,
        p_amount: amount,
        p_movement_type: 'out',
        p_reference_type: 'capital_withdrawal',
        p_reference_id: null,
        p_description: description || 'سحب أموال من القاصة',
        p_created_by: user.id
      });

      if (error) throw error;

      // تحديث البيانات
      await fetchCashSources();
      await fetchCashMovements();

      toast({
        title: "تم بنجاح",
        description: `تم سحب ${amount.toLocaleString()} د.ع من القاصة`
      });

      return { success: true };
    } catch (error) {
      console.error('خطأ في سحب الأموال:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في سحب الأموال",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // الحصول على إجمالي الرصيد من قاعدة البيانات
  const getTotalBalance = () => {
    return cashSources.reduce((total, source) => total + (source.current_balance || 0), 0);
  };

  // الحصول على رصيد القاصة الرئيسية (رأس المال + صافي الأرباح)
  const getMainCashBalance = async () => {
    try {
      // جلب رأس المال من الإعدادات
      const { data: appSettings, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'app_settings')
        .single();

      if (settingsError) {
        console.error('خطأ في جلب رأس المال:', settingsError);
      }

      const capital = appSettings?.value?.capital || 0;

      // حساب الأرباح المحققة من الطلبات المستلمة الفواتير
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          final_amount,
          total_amount,
          delivery_fee,
          order_items!inner (
            unit_price,
            quantity,
            product_variants (cost_price),
            products (cost_price)
          )
        `)
        .eq('status', 'delivered')
        .eq('receipt_received', true);
      
      if (ordersError) {
        console.error('خطأ في جلب بيانات الطلبات:', ordersError);
      }

      // حساب صافي الأرباح من الطلبات المحققة
      const realizedProfits = ordersData?.reduce((totalProfit, order) => {
        if (!order.order_items) return totalProfit;
        
        const orderProfit = order.order_items.reduce((itemSum, item) => {
          const sellPrice = item.unit_price || 0;
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          const itemProfit = (sellPrice - costPrice) * quantity;
          return itemSum + Math.max(itemProfit, 0);
        }, 0);
        
        return totalProfit + orderProfit;
      }, 0) || 0;

      // رصيد القاصة الرئيسية = رأس المال + صافي الأرباح المحققة
      const mainCashBalance = capital + realizedProfits;

      console.log('💰 تفاصيل رصيد القاصة الرئيسية:', {
        baseCapital: capital,
        realizedProfits,
        totalMainCashBalance: mainCashBalance
      });

      return mainCashBalance;
    } catch (error) {
      console.error('خطأ في حساب رصيد القاصة الرئيسية:', error);
      return 0;
    }
  };

  // الحصول على مجموع أرصدة المصادر الفعلية (بدون القاصة الرئيسية)
  const getTotalSourcesBalance = () => {
    return cashSources
      .filter(source => source.name !== 'القاصة الرئيسية')
      .reduce((total, source) => total + (source.current_balance || 0), 0);
  };

  // دالة للتوافق مع النسخة السابقة - تعيد مجموع المصادر
  const getRealCashBalance = () => {
    return getTotalSourcesBalance();
  };

  // حساب مجموع جميع المصادر بما في ذلك القاصة الرئيسية الحقيقية
  const getTotalAllSourcesBalance = async () => {
    const mainBalance = await getMainCashBalance(); // القاصة الرئيسية (رأس المال + الأرباح)
    const otherBalance = getTotalSourcesBalance(); // باقي المصادر
    return mainBalance + otherBalance;
  };

  // الحصول على القاصة الرئيسية
  const getMainCashSource = async () => {
    const mainSource = cashSources.find(source => source.name === 'القاصة الرئيسية') || cashSources[0];
    if (mainSource && mainSource.name === 'القاصة الرئيسية') {
      const calculatedBalance = await getMainCashBalance();
      return {
        ...mainSource,
        calculatedBalance
      };
    }
    return mainSource;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCashSources(),
        fetchCashMovements()
      ]);
      setLoading(false);
    };

    loadData();

    // Realtime subscriptions للجداول المالية
    const cashSourcesSubscription = supabase
      .channel('cash_sources_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cash_sources' },
        () => {
          console.log('🔄 Cash sources changed, refreshing...');
          fetchCashSources();
        }
      )
      .subscribe();

    const cashMovementsSubscription = supabase
      .channel('cash_movements_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cash_movements' },
        () => {
          console.log('🔄 Cash movements changed, refreshing...');
          fetchCashMovements();
        }
      )
      .subscribe();

    // Real-time subscription للطلبات لتحديث الأرباح
    const ordersSubscription = supabase
      .channel('orders_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('🔄 Order updated, refreshing cash sources...');
          // إذا تم تحديث حالة الطلب للتسليم، قم بتحديث الأرباح
          if (payload.new.status === 'delivered' || payload.new.receipt_received) {
            fetchCashSources();
          }
        }
      )
      .subscribe();

    // Real-time subscription للمشتريات
    const purchasesSubscription = supabase
      .channel('purchases_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'purchases' },
        () => {
          console.log('🔄 Purchases changed, refreshing cash sources...');
          fetchCashSources();
          fetchCashMovements();
        }
      )
      .subscribe();

    // Real-time subscription للمصاريف
    const expensesSubscription = supabase
      .channel('expenses_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          console.log('🔄 Expenses changed, refreshing cash sources...');
          fetchCashSources();
          fetchCashMovements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cashSourcesSubscription);
      supabase.removeChannel(cashMovementsSubscription);
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(purchasesSubscription);
      supabase.removeChannel(expensesSubscription);
    };
  }, []);

  return {
    cashSources,
    cashMovements,
    loading,
    addCashSource,
    addCashToSource,
    withdrawCashFromSource,
    fetchCashSources,
    fetchCashMovements,
    getTotalBalance,
    getRealCashBalance,
    getMainCashBalance,
    getTotalSourcesBalance,
    getTotalAllSourcesBalance,
    getMainCashSource
  };
};