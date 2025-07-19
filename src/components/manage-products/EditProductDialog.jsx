import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Save, Plus, Settings } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Progress } from "@/components/ui/progress";
import { generateUniqueBarcode } from '@/lib/barcode-utils';

import ProductPrimaryInfo from '@/components/add-product/ProductPrimaryInfo';
import MultiSelectCategorization from '@/components/add-product/MultiSelectCategorization';
import ProductVariantSelection from '@/components/add-product/ProductVariantSelection';
import ColorVariantCard from '@/components/add-product/ColorVariantCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

const SortableColorCard = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.color.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ColorVariantCard {...props} dragHandleProps={listeners} />
    </div>
  );
};

const EditProductDialog = ({ product, open, onOpenChange, onSuccess, refetchProducts }) => {
  const { updateProduct } = useInventory();
  const { sizes, colors: allColors, addColor } = useVariants();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [productInfo, setProductInfo] = useState({});
  const [generalImages, setGeneralImages] = useState(Array(4).fill(null));
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState([]);
  const [selectedSeasonsOccasions, setSelectedSeasonsOccasions] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [sizeType, setSizeType] = useState('letter');
  const [colorSizeTypes, setColorSizeTypes] = useState({});
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState({});

  const isUploading = useMemo(() => uploadProgress > 0 && uploadProgress < 100, [uploadProgress]);

  const resetState = useCallback(() => {
    if (product && open) {
      setProductInfo({
        name: product.name || '',
        description: product.description || '',
        price: product.base_price || product.price || '',
        costPrice: product.cost_price || product.costPrice || '',
      });

      const initialGeneralImages = Array(4).fill(null);
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img, index) => {
          if (index < 4) initialGeneralImages[index] = img;
        });
      }
      setGeneralImages(initialGeneralImages);

      // تحديث التصنيفات والأقسام
      setSelectedCategories(product.product_categories?.map(pc => pc.category_id) || []);
      setSelectedProductTypes(product.product_product_types?.map(ppt => ppt.product_type_id) || []);
      setSelectedSeasonsOccasions(product.product_seasons_occasions?.map(pso => pso.season_occasion_id) || []);
      setSelectedDepartments(product.product_departments?.map(pd => pd.department_id) || []);
      
      // تحديد الألوان والأقياس
      const uniqueColorIds = [...new Set((product.product_variants || product.variants || []).map(v => v.color_id))];
      const productColors = uniqueColorIds.map(id => allColors.find(c => c.id === id)).filter(Boolean);
      setSelectedColors(productColors);

      const firstVariant = (product.product_variants || product.variants || [])[0];
      if (firstVariant) {
        const size = sizes.find(s => s.id === firstVariant.size_id);
        if (size) setSizeType(size.type);
      }
      
      // تحديث المتغيرات مع ضمان الحصول على البيانات الصحيحة
      const productVariants = product.product_variants || product.variants || [];
      const productInventory = product.inventory || [];
      console.log('🔍 Product variants loaded:', productVariants);
      console.log('🔍 Product inventory loaded:', productInventory);
      
      const updatedVariants = productVariants.map(variant => {
        // إضافة البيانات المفقودة من العلاقات
        const inventoryItem = productInventory.find(inv => inv.variant_id === variant.id);
        const variantWithFullData = {
          ...variant,
          colorId: variant.color_id,
          sizeId: variant.size_id,
          // جلب اسم اللون والحجم من البيانات المرتبطة
          color: variant.colors?.name || allColors.find(c => c.id === variant.color_id)?.name || 'غير محدد',
          size: variant.sizes?.name || sizes.find(s => s.id === variant.size_id)?.name || 'غير محدد',
          // ضمان وجود بيانات المخزون الصحيحة
          quantity: inventoryItem?.quantity || variant.quantity || 0,
          costPrice: variant.cost_price || variant.costPrice || 0,
          price: variant.price,
          profitAmount: variant.profit_amount || product.profit_amount || 0,
          barcode: variant.barcode,
          images: variant.images || [],
          inventory: inventoryItem // إضافة بيانات المخزون للمتغير
        };
        
        // توليد باركود إذا لم يكن موجود
        if (!variantWithFullData.barcode || variantWithFullData.barcode.trim() === '') {
          const color = allColors.find(c => c.id === variant.color_id);
          const size = sizes.find(s => s.id === variant.size_id);
          variantWithFullData.barcode = generateUniqueBarcode(
            product.name,
            color?.name || 'DEFAULT',
            size?.name || 'DEFAULT',
            product.id
          );
        }
        
        return variantWithFullData;
      });
      
      setVariants(updatedVariants);

      // تحديد صور الألوان
      const initialColorImages = {};
      updatedVariants.forEach(v => {
        if (v.images && v.images.length > 0 && !initialColorImages[v.color_id]) {
          initialColorImages[v.color_id] = v.images[0];
        }
      });
      setColorImages(initialColorImages);
    }
  }, [product, open, allColors, sizes]);

  useEffect(() => {
    resetState();
  }, [resetState]);

  const allSizesForType = useMemo(() => {
    const typeToFilter = sizeType || 'letter';
    return sizes.filter(s => s.type === typeToFilter);
  }, [sizes, sizeType]);

  const handleColorImageSelect = useCallback((colorId, file) => {
    setColorImages(prev => ({...prev, [colorId]: file}));
  }, []);
  
  const handleColorImageRemove = useCallback((colorId) => {
    setColorImages(prev => {
        const newImages = {...prev};
        delete newImages[colorId];
        return newImages;
    });
  }, []);
  
  const handleGeneralImageSelect = useCallback((index, file) => {
    const newImages = [...generalImages];
    newImages[index] = file;
    setGeneralImages(newImages);
  }, [generalImages]);
  
  const removeGeneralImage = useCallback((index) => {
    const newImages = [...generalImages];
    newImages[index] = null;
    setGeneralImages(newImages);
  }, [generalImages]);

  const handleSave = async () => {
    if (!product) return;
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const dataToUpdate = {
        ...productInfo,
        price: parseFloat(productInfo.price) || 0,
        costPrice: productInfo.costPrice ? parseFloat(productInfo.costPrice) : 0,
        selectedCategories,
        selectedProductTypes,
        selectedSeasonsOccasions,
        selectedDepartments,
        variants,
      };
      
      const imageFiles = {
        general: generalImages,
        colorImages: colorImages,
      };
      
      const result = await updateProduct(product.id, dataToUpdate, imageFiles, setUploadProgress);

      if (result.success) {
        toast({ title: 'نجاح', description: 'تم تحديث المنتج بنجاح!' });
        
        // إعادة تحميل المنتجات
        if (refetchProducts) {
          await refetchProducts();
        }
        
        if(onSuccess) onSuccess();
        onOpenChange(false);
      } else {
        toast({ title: 'خطأ', description: result.error || 'فشل تحديث المنتج.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedColors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold">تعديل المنتج: {product.name}</DialogTitle>
          <DialogDescription>قم بتحديث تفاصيل المنتج والمتغيرات والمخزون من هنا.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ProductPrimaryInfo 
            productInfo={productInfo} 
            setProductInfo={setProductInfo}
            generalImages={generalImages}
            onImageSelect={handleGeneralImageSelect}
            onImageRemove={removeGeneralImage}
          />
          
          <MultiSelectCategorization 
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedProductTypes={selectedProductTypes}
            setSelectedProductTypes={setSelectedProductTypes}
            selectedSeasonsOccasions={selectedSeasonsOccasions}
            setSelectedSeasonsOccasions={setSelectedSeasonsOccasions}
            selectedDepartments={selectedDepartments}
            setSelectedDepartments={setSelectedDepartments}
          />
          
          <ProductVariantSelection 
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            sizeType={sizeType}
            setSizeType={setSizeType}
            colorSizeTypes={colorSizeTypes}
            setColorSizeTypes={setColorSizeTypes}
          />
          
          {/* عرض القياسات لكل لون */}
          {selectedColors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  إعداد القياسات لكل لون
                </CardTitle>
                <CardDescription>اختر القياسات المتاحة لكل لون من الألوان المحددة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedColors.map(color => {
                  const colorSizes = allSizesForType;
                  return (
                    <div key={color.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: color.hex_code || color.hex || '#ccc' }}
                        />
                        <h4 className="font-medium">{color.name}</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {colorSizes.map(size => {
                          const variantForSize = variants.find(v => v.color_id === color.id && v.size_id === size.id);
                          const isSelected = !!variantForSize;
                          
                          return (
                            <div
                              key={size.id}
                              className={`p-2 rounded-md border cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-primary text-primary-foreground border-primary' 
                                  : 'bg-muted/50 hover:bg-muted border-border'
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  // إزالة المتغير
                                  setVariants(prev => prev.filter(v => !(v.color_id === color.id && v.size_id === size.id)));
                                } else {
                                  // إضافة متغير جديد
                                  const newVariant = {
                                    id: `new-${color.id}-${size.id}`,
                                    color_id: color.id,
                                    size_id: size.id,
                                    colorId: color.id,
                                    sizeId: size.id,
                                    color: color.name,
                                    size: size.name,
                                    quantity: 0,
                                    price: parseFloat(productInfo.price) || 0,
                                    costPrice: parseFloat(productInfo.costPrice) || 0,
                                    profitAmount: parseFloat(productInfo.price || 0) - parseFloat(productInfo.costPrice || 0),
                                    barcode: generateUniqueBarcode(productInfo.name, color.name, size.name, product.id),
                                    images: [],
                                    is_new: true
                                  };
                                  setVariants(prev => [...prev, newVariant]);
                                }
                              }}
                            >
                              <div className="text-center text-sm font-medium">{size.name}</div>
                              {isSelected && (
                                <div className="text-xs text-center mt-1 opacity-75">
                                  {variantForSize.quantity || 0} قطعة
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          
          {/* إدارة متغيرات المنتج */}
          {selectedColors.length > 0 && variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>إدارة المتغيرات والكميات</CardTitle>
                <CardDescription>هنا يمكنك التحكم في كل متغير من متغيرات المنتج، بما في ذلك السعر والمخزون.</CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {selectedColors.map((color) => {
                        const colorVariants = variants.filter(v => v.color_id === color.id);
                        if (colorVariants.length === 0) return null;
                        
                        const initialImage = colorImages[color.id];
                        let preview = null;
                        if (initialImage) {
                          preview = typeof initialImage === 'string' ? initialImage : URL.createObjectURL(initialImage);
                        }
                        
                        return (
                           <SortableColorCard
                            key={color.id}
                            color={color}
                            allSizesForType={allSizesForType}
                            variants={colorVariants}
                            setVariants={setVariants}
                            price={productInfo.price}
                            costPrice={productInfo.costPrice}
                            handleImageSelect={(file) => handleColorImageSelect(color.id, file)}
                            handleImageRemove={() => handleColorImageRemove(color.id)}
                            initialImage={preview}
                            isEditMode={true}
                            showInventoryData={true}
                            productName={productInfo.name}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}
        </div>
        
        <DialogFooter className="pt-4 border-t bg-background">
            <div className="flex items-center justify-between w-full">
              {isUploading && (
                <div className='flex items-center gap-2'>
                  <Progress value={uploadProgress} className="w-32" />
                  <span className='text-sm text-muted-foreground'>{Math.round(uploadProgress)}%</span>
                </div>
              )}
              {!isUploading && <div></div>}
              <div className="flex gap-2">
                  <DialogClose asChild>
                      <Button variant="outline">إلغاء</Button>
                  </DialogClose>
                  <Button onClick={handleSave} disabled={isSubmitting || isUploading}>
                      {isSubmitting || isUploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                      {isSubmitting || isUploading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
              </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;