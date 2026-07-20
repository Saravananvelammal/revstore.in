//js/products/add-product.js

'use strict';

window.RevstoreRetailerProductModules =
  window.RevstoreRetailerProductModules || {};

window.RevstoreRetailerProductModules.createAddProductModule =
  function createAddProductModule(context) {
    const {
      State,
      UI,
      showToast,
      resetProductModal,
      setSubmitLoading,
      openProductModal,
      updateFormOfferPercent,
      syncTaxOverrideState,
      syncAvailabilityMode
    } = context;

    function openAddModal() {
      if (
        State.pageLoading ||
        State.productLoading ||
        State.submitLoading
      ) {
        return;
      }

      if (
        !State.selectedCategory ||
        !State.selectedSubcategory
      ) {
        showToast(
          'Select a category and subcategory before adding a product.',
          'warning'
        );

        return;
      }

      resetProductModal();

      if (UI.modalTitle) {
        UI.modalTitle.textContent =
          'Add Product';
      }

      if (UI.productCategory) {
        UI.productCategory.value =
          State.selectedCategory;
      }

      if (UI.productSubcategory) {
        UI.productSubcategory.value =
          State.selectedSubcategory;
      }

      if (UI.productStock) {
        UI.productStock.value = '0';
      }

      if (UI.productManualTaxOverride) {
        UI.productManualTaxOverride.checked =
          false;
      }

      if (UI.availabilityAlways) {
        UI.availabilityAlways.checked =
          true;
      }

      if (UI.availabilityCustom) {
        UI.availabilityCustom.checked =
          false;
      }

      updateFormOfferPercent();
      syncTaxOverrideState();
      syncAvailabilityMode();
      setSubmitLoading(false);
      openProductModal();
    }

    return Object.freeze({
      openAddModal
    });
  };