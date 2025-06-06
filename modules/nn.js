/** @format */

class NeuralNetwork {
	constructor(a, b, c, d) {
		if (a instanceof tf.Sequential) {
			this.model = a;
			this.input_nodes = b;
			this.hidden_nodes = c;
			this.output_nodes = d;
		} else {
			this.input_nodes = a;
			this.hidden_nodes = b;
			this.output_nodes = c;
			this.model = this.createModel();
		}
	}

	async loadPretrainedWeights(path) {
		// Load weights asynchronously into the existing model
		const pretrainedModel = await tf.loadLayersModel(path);
		this.model.setWeights(pretrainedModel.getWeights());
		console.log('Pretrained weights loaded successfully');
	}

	copy() {
		return tf.tidy(() => {
			const modelCopy = this.createModel();
			const weights = this.model.getWeights();
			const weightCopies = [];
			for (let i = 0; i < weights.length; i++) {
				weightCopies[i] = weights[i].clone();
			}

			modelCopy.setWeights(weightCopies);
			return new NeuralNetwork(modelCopy, this.input_nodes, this.hidden_nodes, this.output_nodes);
		});
	}

	feature() {
		return tf.tidy(() => {
			const weights = this.model.getWeights();
			const summary = [];

			for (let i = 0; i < weights.length; i++) {
				const w = weights[i];

				const meanScalar = w.mean();
				const meanValue = meanScalar.dataSync()[0];
				summary.push(meanValue);
				meanScalar.dispose();
			}

			return summary;
		});
	}

	mutate(rate) {
		tf.tidy(() => {
			const weights = this.model.getWeights();
			const mutatedWeights = [];
			for (let i = 0; i < weights.length; i++) {
				let tensor = weights[i];
				let shape = weights[i].shape;
				let values = tensor.dataSync().slice();
				for (let j = 0; j < values.length; j++) {
					if (random(1) < rate) {
						let w = values[j];
						values[j] = w + randomGaussian();
					}
				}
				let newTensor = tf.tensor(values, shape);
				mutatedWeights[i] = newTensor;
			}
			this.model.setWeights(mutatedWeights);
		});
	}

	dispose() {
		this.model.dispose();
	}

	predict(inputs) {
		return tf.tidy(() => {
			const xs = tf.tensor2d([inputs]);
			const ys = this.model.predict(xs);
			const outputs = ys.dataSync();
			return outputs;
		});
	}

	createModel() {
		const model = tf.sequential();

		const hidden1 = tf.layers.dense({
			units: this.hidden_nodes,
			inputShape: [this.input_nodes],
			activation: 'relu',
		});
		model.add(hidden1);

		const hidden2 = tf.layers.dense({
			units: Math.max(4, Math.floor(this.hidden_nodes * 0.75)),
			activation: 'relu',
		});
		model.add(hidden2);

		const hidden3 = tf.layers.dense({
			units: Math.max(2, Math.floor(this.hidden_nodes / 2)),
			activation: 'relu',
		});
		model.add(hidden3);

		const output = tf.layers.dense({
			units: this.output_nodes,
			activation: 'tanh',
		});
		model.add(output);

		return model;
	}
}
