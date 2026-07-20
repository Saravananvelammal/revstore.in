//js/products/get-product.js

'use strict';

window.RevstoreRetailerProductModules =
  window.RevstoreRetailerProductModules || {};

window.RevstoreRetailerProductModules.createGetProductModule =
  function createGetProductModule(context) {
    const {
      API,
      apiFetch,
      getProductId
    } = context;

    async function fetchProductDetail(productId) {
      const safeProductId =
        String(productId || '').trim();

      if (!safeProductId) {
        const idError =
          new Error(
            'Product ID is required.'
          );

        idError.status = 400;
        throw idError;
      }

      const payload =
        await apiFetch(
          API.product(safeProductId) +
            '?includeDeleted=true',
          {
            method: 'GET'
          }
        );

      const product =
        payload &&
        payload.product &&
        typeof payload.product === 'object'
          ? payload.product
          : payload &&
              payload.data &&
              payload.data.product &&
              typeof payload.data.product ===
                'object'
            ? payload.data.product
            : payload &&
                payload.data &&
                typeof payload.data ===
                  'object'
              ? payload.data
              : payload;

      if (
        !product ||
        typeof product !== 'object' ||
        !getProductId(product)
      ) {
        const responseError =
          new Error(
            'Product details could not be loaded.'
          );

        responseError.status = 502;
        throw responseError;
      }

      /*
       * Return the complete object. This retains:
       * taxProfile, availability, location, images and
       * any future backend fields.
       */
      return product;
    }

    return Object.freeze({
      fetchProductDetail
    });
  };