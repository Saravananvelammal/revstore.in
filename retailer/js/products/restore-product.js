//js/products/restore-product.js

'use strict';

window.RevstoreRetailerProductModules =
  window.RevstoreRetailerProductModules || {};

window.RevstoreRetailerProductModules.createRestoreProductModule =
  function createRestoreProductModule(context) {
    const {
      State,
      API,
      apiFetch,
      getProductId,
      cleanText,
      setProductLoading,
      showToast,
      handleError,
      loadProducts
    } = context;

    async function restoreProduct(product) {
      if (
        State.productLoading ||
        State.submitLoading
      ) {
        return false;
      }

      const productId =
        getProductId(product);

      if (!productId) {
        showToast(
          'Invalid product selected.',
          'error'
        );

        return false;
      }

      const productName =
        cleanText(
          product && product.name,
          'this product'
        );

      const confirmed =
        window.confirm(
          'Restore "' +
            productName +
            '"?'
        );

      if (!confirmed) {
        return false;
      }

      setProductLoading(
        true,
        'Restoring product...'
      );

      try {
        const response =
          await apiFetch(
            API.restoreProduct(productId),
            {
              method: 'PUT'
            }
          );

        showToast(
          cleanText(
            response.message,
            'Product restored successfully.'
          ),
          'success'
        );

        await loadProducts(State.page);

        return true;
      } catch (error) {
        handleError(error);
        return false;
      } finally {
        setProductLoading(false);
      }
    }

    return Object.freeze({
      restoreProduct
    });
  };