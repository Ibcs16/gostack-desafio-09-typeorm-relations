import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }
    const findProducts = await this.productsRepository.findAllById(products);

    const order_products = products.map(product => {
      const findProduct = findProducts.find(item => item.id === product.id);

      if (!findProduct) {
        throw new AppError(`Produto with id ${product.id} not found`);
      }

      if (product.quantity > findProduct.quantity) {
        throw new AppError(
          'Um ou mais dos produtos enviados não possui a quantidade necessária.',
        );
      }

      findProduct.quantity -= product.quantity;

      return {
        quantity: product.quantity,
        product_id: product.id,
        price: findProduct.price,
      };
    });

    const totalPrice = order_products
      .map(product => product.quantity * product.price)
      .reduce((a, b) => a + b);

    const order = await this.ordersRepository.create({
      customer,
      price: totalPrice,
      products: order_products,
    });

    await this.productsRepository.updateQuantity(findProducts);

    return order;
  }
}

export default CreateOrderService;
