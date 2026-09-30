const wc = window.console

export const l = console.log.bind(wc)
export const cl = console.clear.bind(wc)
export const t = console.time.bind(wc)
export const te = console.timeEnd.bind(wc)

export const updateMatrix = mesh => {
	mesh.updateMatrix()
	mesh.geometry.applyMatrix4(mesh.matrix)
	mesh.matrix.identity()
	mesh.position.set(0, 0, 0);
	mesh.rotation.set(0, 0, 0);
	mesh.scale.set(1, 1, 1);
}

export const randomNum = (min, max) => Math.random()*(max-min+1)+min

export const randomInt = (min, max) => {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1) + min)
}