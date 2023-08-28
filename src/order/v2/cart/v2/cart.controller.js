import CartService from './cart.service.js';
import BadRequestParameterError from '../../../../lib/errors/bad-request-parameter.error.js';
import {re} from "@babel/core/lib/vendor/import-meta-resolve.js";

const cartService = new CartService();

class CartController {

    async addItem(req, res, next) {
        try {

           return  res.send(await cartService.addItem({...req.body,...req.params}));

        }
        catch (err) {
           next(err);
        }
    }

    async getCartItem(req, res, next) {
        try {

            return  res.send(await cartService.getCartItem({...req.body,...req.params}));

        }
        catch (err) {
            next(err);
        }
    }

    async updateItem(req, res, next) {
        try {
            return  res.send(await cartService.updateItem({...req.body,...req.params}));
        }
        catch (err) {
            next(err);
        }
    }

    async removeItem(req, res, next) {
        try {
            return  res.send(await cartService.removeItem({...req.body,...req.params}));

        }
        catch (err) {
            next(err);
        }
    }

    async clearCart(req, res, next) {
        try {
            return  res.send(await cartService.clearCart({...req.body,...req.params}));
        }
        catch (err) {
            next(err);
        }
    }

}

export default CartController;
