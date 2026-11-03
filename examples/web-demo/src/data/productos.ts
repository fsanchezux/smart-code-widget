export interface Producto {
  id: number;
  nombre: string;
  categoria: 'Hogar' | 'Oficina' | 'Cocina';
  precio: number;
}

export const productos: Producto[] = [
  { id: 1, nombre: 'Lámpara de escritorio', categoria: 'Oficina', precio: 34.9 },
  { id: 2, nombre: 'Silla ergonómica', categoria: 'Oficina', precio: 189 },
  { id: 3, nombre: 'Cafetera italiana', categoria: 'Cocina', precio: 27.5 },
  { id: 4, nombre: 'Juego de sartenes', categoria: 'Cocina', precio: 64 },
  { id: 5, nombre: 'Manta de lana', categoria: 'Hogar', precio: 42 },
  { id: 6, nombre: 'Maceta de cerámica', categoria: 'Hogar', precio: 18.75 },
  { id: 7, nombre: 'Organizador de cables', categoria: 'Oficina', precio: 12.9 },
  { id: 8, nombre: 'Tabla de cortar de bambú', categoria: 'Cocina', precio: 22 },
];

export const categorias = ['Hogar', 'Oficina', 'Cocina'] as const;
