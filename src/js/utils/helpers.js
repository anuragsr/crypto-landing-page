const wc = window.console
module.exports = {
	l: console.log.bind(wc),
	cl: console.clear.bind(wc),
	t: console.time.bind(wc),
	te: console.timeEnd.bind(wc),
	updateTransform: mesh => {
		mesh.updateMatrix();
		mesh.geometry.applyMatrix( mesh.matrix );
		mesh.matrix.identity();
		mesh.position.set( 0, 0, 0 );
		mesh.rotation.set( 0, 0, 0 );
		mesh.scale.set( 1, 1, 1 );
	}
}