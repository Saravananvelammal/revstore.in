//js/products/edit-product.js

'use strict';

window.RevstoreRetailerProductModules =
  window.RevstoreRetailerProductModules || {};

window.RevstoreRetailerProductModules.createEditProductModule =
  function createEditProductModule(context) {
    const {
      State,
      UI,
      getProductId,
      getProductImages,
      cleanText,
      normalizeKey,
      toInputNumberFromPaise,
      resetProductModal,
      renderExistingImages,
      renderNewImages,
      setSubmitLoading,
      setPageLoading,
      openProductModal,
      showToast,
      handleError,
      getProductModule,
      getProductTaxProfile,
      getProductAvailability,
      getProductLocation,
      updateFormOfferPercent,
      syncTaxOverrideState,
      syncAvailabilityMode
    } = context;

    async function openEditModal(productSummary) {
      const productId =
        getProductId(productSummary);

      if (!productId) {
        showToast(
          'Invalid product selected.',
          'error'
        );

        return;
      }

      if (
        productSummary &&
        productSummary.isDeleted === true
      ) {
        showToast(
          'Restore this product before editing it.',
          'warning'
        );

        return;
      }

      if (
        State.pageLoading ||
        State.productLoading ||
        State.submitLoading
      ) {
        return;
      }

      setPageLoading(
        true,
        'Loading product details...'
      );

      try {
        const product =
          await getProductModule
            .fetchProductDetail(productId);

        resetProductModal();

        State.editingProduct = product;
        State.existingImages =
          getProductImages(product);

        if (UI.modalTitle) {
          UI.modalTitle.textContent =
            'Edit Product';
        }

        if (UI.productId) {
          UI.productId.value =
            productId;
        }

        if (UI.productName) {
          UI.productName.value =
            cleanText(product.name);
        }

        if (UI.productDescription) {
          UI.productDescription.value =
            cleanText(product.description);
        }

        if (UI.productStock) {
          const stock =
            Number(product.stock);

          UI.productStock.value =
            Number.isFinite(stock)
              ? String(Math.max(0, stock))
              : '0';
        }

        if (UI.productCategory) {
          UI.productCategory.value =
            cleanText(
              product.category,
              State.selectedCategory
            );
        }

        if (UI.productSubcategory) {
          const productSubcategory =
            cleanText(
              product.subCategory,
              State.selectedSubcategory
            );

          const optionExists =
            Array.from(
              UI.productSubcategory.options
            ).some(function (option) {
              return (
                normalizeKey(option.value) ===
                normalizeKey(
                  productSubcategory
                )
              );
            });

          if (
            productSubcategory &&
            !optionExists
          ) {
            const option =
              document.createElement('option');

            option.value =
              productSubcategory;

            option.textContent =
              productSubcategory;

            UI.productSubcategory
              .appendChild(option);
          }

          UI.productSubcategory.value =
            productSubcategory;
        }

        if (UI.productRevPrice) {
          UI.productRevPrice.value =
            toInputNumberFromPaise(
              product.priceRev
            );
        }

        if (UI.productOfferPrice) {
          UI.productOfferPrice.value =
            toInputNumberFromPaise(
              product.offerPrice
            );
        }

        if (UI.productPrice) {
          UI.productPrice.value =
            toInputNumberFromPaise(
              product.price
            );
        }

        if (UI.productActualPrice) {
          UI.productActualPrice.value =
            toInputNumberFromPaise(
              product.priceActual
            );
        }

        const taxProfile =
          getProductTaxProfile(product);

        State.taxProfile =
          taxProfile.raw;

        if (UI.productManualTaxOverride) {
          UI.productManualTaxOverride.checked =
          taxProfile.manualOverride;
        }

        if (UI.productHsnCode) {
          UI.productHsnCode.value =
            taxProfile.hsnCode;
        }

        if (UI.productGstRate) {
          UI.productGstRate.value =
            String(
              taxProfile.gstRatePercent
            );
        }

        if (UI.productCessRate) {
          UI.productCessRate.value =
            String(
              taxProfile.cessRatePercent
            );
        }

        if (UI.productCessPerUnit) {
          UI.productCessPerUnit.value =
            String(
              taxProfile.cessPerUnitRupees
            );
        }

        if (UI.productTaxSource) {
          UI.productTaxSource.value =
            taxProfile.taxSource;
        }

        const availability =
          getProductAvailability(product);

        State.availabilityWeekly =
          availability.weekly;

        if (UI.availabilityAlways) {
          UI.availabilityAlways.checked =
            availability.mode === 'always';
        }

        if (UI.availabilityCustom) {
          UI.availabilityCustom.checked =
            availability.mode === 'custom';
        }

        const productLocation =
          getProductLocation(product);

        State.productLocation =
          productLocation.raw;

        if (UI.productLocationAddress) {
          UI.productLocationAddress.value =
            productLocation.address;
        }

        if (UI.productLatitude) {
          UI.productLatitude.value =
            productLocation.latitude == null
              ? ''
              : String(
                  productLocation.latitude
                );
        }

        if (UI.productLongitude) {
          UI.productLongitude.value =
            productLocation.longitude == null
              ? ''
              : String(
                  productLocation.longitude
                );
        }

        updateFormOfferPercent();
        syncTaxOverrideState();
        syncAvailabilityMode(); 

        renderExistingImages();
        renderNewImages();
        setSubmitLoading(false);
        openProductModal();
      } catch (error) {
        handleError(error);
      } finally {
        setPageLoading(false);
      }
    }

    return Object.freeze({
      openEditModal
    });
  };