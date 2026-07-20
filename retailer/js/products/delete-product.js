//js/products/delete-product.js

'use strict';

window.RevstoreRetailerProductModules =
  window.RevstoreRetailerProductModules || {};

window.RevstoreRetailerProductModules.createDeleteProductModule =
  function createDeleteProductModule(context) {
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

    async function deleteProduct(product) {
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
          'Delete "' +
            productName +
            '"? It can be restored later.'
        );

      if (!confirmed) {
        return false;
      }

      setProductLoading(
        true,
        'Deleting product...'
      );

      try {
        const response =
          await apiFetch(
            API.product(productId),
            {
              method: 'DELETE'
            }
          );

        showToast(
          cleanText(
            response.message,
            'Product deleted successfully.'
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
      deleteProduct
    });
  };