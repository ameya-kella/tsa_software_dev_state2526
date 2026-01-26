import numpy as np
import tensorflow as tf
import json
from sklearn.model_selection import train_test_split

INPUT_SIZE = 64
N_ROWS = 87
N_DIMS = 3

BATCH_SIZE = 16
N_EPOCHS = 50
LR = 5e-4  
PATIENCE = 7

# load labels
with open("ord2sign.json", "r") as f:
    ORD2SIGN = json.load(f)

NUM_CLASSES = len(ORD2SIGN)

# load data & split
X = np.load("data/processed/X.npy").astype(np.float32)
y = np.load("data/processed/y.npy").astype(np.int32)
y_onehot = tf.keras.utils.to_categorical(y, NUM_CLASSES)

X_train, X_val, y_train, y_val = train_test_split(
    X, y_onehot, test_size=0.1, stratify=y, random_state=42
)

train_ds = (
    tf.data.Dataset.from_tensor_slices((X_train, y_train))
    .shuffle(2048)
    .batch(BATCH_SIZE)
    .cache()
    .prefetch(tf.data.AUTOTUNE)
)

val_ds = (
    tf.data.Dataset.from_tensor_slices((X_val, y_val))
    .batch(BATCH_SIZE)
    .cache()
    .prefetch(tf.data.AUTOTUNE)
)

# model layers
@tf.keras.utils.register_keras_serializable()
class NormalizeLandmarks(tf.keras.layers.Layer):
    def call(self, x):
        xy = x[..., :2]
        center = tf.reduce_mean(xy, axis=2, keepdims=True)
        xy = xy - center
        scale = tf.reduce_max(tf.abs(xy), axis=[2,3], keepdims=True)
        xy = xy / (scale + 1e-6)
        return tf.concat([xy, x[..., 2:3]], axis=-1)


@tf.keras.utils.register_keras_serializable()
class FrameMask(tf.keras.layers.Layer):
    def call(self, frames):
        mask = tf.reduce_any(tf.not_equal(frames, 0.0), axis=[2, 3])
        return tf.cast(mask, tf.float32)


@tf.keras.utils.register_keras_serializable()
class LandmarkEmbedding(tf.keras.layers.Layer):
    def __init__(self, units):
        super().__init__()
        self.fc = tf.keras.Sequential([
            tf.keras.layers.Dense(units, activation="gelu"),
            tf.keras.layers.Dense(units)
        ])

    def call(self, x):
        return self.fc(x)


@tf.keras.utils.register_keras_serializable()
class Embedding(tf.keras.layers.Layer):
    def __init__(self, units=512):
        super().__init__()
        self.lips = LandmarkEmbedding(384)
        self.left = LandmarkEmbedding(384)
        self.right = LandmarkEmbedding(384)
        self.pose = LandmarkEmbedding(384)

        self.landmark_weights = self.add_weight(
            shape=(4,), initializer="zeros", trainable=True
        )

        self.fc = tf.keras.Sequential([
            tf.keras.layers.Dense(units, activation="gelu"),
            tf.keras.layers.Dense(units)
        ])

        self.pos_trainable = self.add_weight(
            shape=(INPUT_SIZE, units), initializer="random_normal", trainable=True
        )

    def call(self, lips, left, right, pose):
        x = tf.stack([
            self.lips(lips),
            self.left(left),
            self.right(right),
            self.pose(pose)
        ], axis=-1)
        x = tf.reduce_sum(x * tf.nn.softmax(self.landmark_weights), axis=-1)
        x = self.fc(x)

        pos = tf.cast(self.pos_trainable, x.dtype)
        return x + pos

class MultiHeadAttention(tf.keras.layers.Layer):
    def __init__(self, d_model, heads, dropout=0.1):
        super().__init__()
        self.mha = tf.keras.layers.MultiHeadAttention(
            num_heads=heads, key_dim=int(d_model // heads), dropout=dropout
        )

    def call(self, x, mask):
        return self.mha(x, x, attention_mask=mask)


@tf.keras.utils.register_keras_serializable()
class Transformer(tf.keras.layers.Layer):
    def __init__(self, blocks=2, units=512, dropout=0.1):
        super().__init__()
        self.blocks = blocks
        self.units = units
        self.dropout = dropout
        self.layers_list = []

    def build(self, input_shape):
        for _ in range(self.blocks):
            ln1 = tf.keras.layers.LayerNormalization(epsilon=1e-6)
            mha = MultiHeadAttention(self.units, 8, dropout=self.dropout)
            ln2 = tf.keras.layers.LayerNormalization(epsilon=1e-6)
            mlp = tf.keras.Sequential([
                tf.keras.layers.Dense(self.units * 2, activation="gelu"),
                tf.keras.layers.Dropout(self.dropout),
                tf.keras.layers.Dense(self.units)
            ])
            self.layers_list.append((ln1, mha, ln2, mlp))
        super().build(input_shape)

    def call(self, x, mask):
        mha_mask = tf.cast(mask[:, None, :], tf.bool)
        for ln1, mha, ln2, mlp in self.layers_list:
            x = x + 0.5 * mha(ln1(x), mha_mask)
            x = x + 0.5 * mlp(ln2(x))
        return x


@tf.keras.utils.register_keras_serializable()
class AttentionPooling(tf.keras.layers.Layer):
    def __init__(self):
        super().__init__()
        self.score_dense = tf.keras.layers.Dense(1)
        self.norm = tf.keras.layers.LayerNormalization()

    def call(self, x, mask):
        mask = mask[..., None]
        score = self.norm(x)
        score = self.score_dense(score)
        score += (1.0 - mask) * -1e9
        weights = tf.nn.softmax(score, axis=1)
        return tf.reduce_sum(x * weights, axis=1)


# model
def get_model():
    frames = tf.keras.Input(shape=(INPUT_SIZE, N_ROWS, N_DIMS), name="frames")

    x = NormalizeLandmarks()(frames)
    mask = FrameMask()(x)

    # velocity features
    x = tf.keras.layers.Lambda(lambda t: tf.concat([
        t,
        tf.pad(t[:, 1:, :, :] - t[:, :-1, :, :], [[0,0],[1,0],[0,0],[0,0]])
    ], axis=-1))(x)

    # landmark splits
    lips = tf.keras.layers.Lambda(lambda t: t[:, :, 0:40, :2])(x)
    left = tf.keras.layers.Lambda(lambda t: t[:, :, 40:61, :2])(x)
    right = tf.keras.layers.Lambda(lambda t: t[:, :, 61:82, :2])(x)
    pose = tf.keras.layers.Lambda(lambda t: t[:, :, 82:87, :2])(x)

    lips = tf.keras.layers.Reshape((INPUT_SIZE, 40*2))(lips)
    left = tf.keras.layers.Reshape((INPUT_SIZE, 21*2))(left)
    right = tf.keras.layers.Reshape((INPUT_SIZE, 21*2))(right)
    pose = tf.keras.layers.Reshape((INPUT_SIZE, 5*2))(pose)

    x = Embedding()(lips, left, right, pose)
    x = Transformer(blocks=4, units=512, dropout=0.2)(x, mask)
    x = AttentionPooling()(x, mask)

    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, dtype='float32')(x)

    model = tf.keras.Model(inputs=frames, outputs=outputs)

    # cosine decay + warmup
    steps_per_epoch = len(X_train) // BATCH_SIZE
    lr_schedule = tf.keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=LR,
        decay_steps=steps_per_epoch * N_EPOCHS
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule, clipnorm=1.0),
        loss=tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=0.1),
        metrics=["accuracy"]
    )
    return model

# train model
model = get_model()

callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=PATIENCE,
        restore_best_weights=True
    )
]

# save as .keras
model.fit(train_ds, validation_data=val_ds, epochs=N_EPOCHS, callbacks=callbacks)
model.save("asl_model.keras")

# convert to tflite as well
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()
with open("asl_model_fp32.tflite", "wb") as f:
    f.write(tflite_model)
