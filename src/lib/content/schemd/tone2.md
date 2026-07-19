# Quantum Information Processing: Foundations - Part 2

## Introduction

Previously, we had a [brief introduction][1] to the idea of geometrically visualizing a $qubit$'s quantum state in a 3D sphere called the Bloch Sphere [@Bloch1946] &mdash; named after Felix Bloch, the Swiss-American physicist. Being able to represent an arbitrary $qubit$ state in space visually simplifies its complexity, and the Bloch Sphere does this. We will go a bit mathematical (with a touch of physics) in this part, primarily to bring into perspective how some expressions came about. Then, we'll pick some problems in [@Rieffel2011] and work through solving them step-by-step to solidify our understanding better.

## Prerequisite

Quantum computing relies on mathematical (**and, briefly in this article, physics**) principles, but you can learn the essentials without being a math whiz. A working knowledge of high school math will equip you to understand the applications and fundamental ideas. Familiarity with the Python programming language will help you understand `qiskit` and/or `cirq` code.

## Qubit Visualization on the Bloch sphere

Consider the Bloch sphere below:
![Bloch Sphere](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/lq27b9qgh0khw8cflkn7.png "Bloch Sphere")
{Figure 1: Bloch Sphere showing the major measurement basis and angles.}

where:

- $\ket{0}$ represents the $z$-axis;
- $\ket{+}$ is the $x$-axis;
- $\ket{i}$ depicts the $y$-axis;
- $\ket{\psi}$ is an arbitrary state on the sphere;
- $\theta$ is the angle the state makes with $z$-axis; and
- $\phi$, the azimuthal angle, is the angle that the state's projection is making with the $x$-axis.

This arbitrary state can be expressed, verbosely, using the state function:

$$
\ket{\psi} = e^{i\gamma}\left(\cos\frac{\theta}{2}\ket{0} + e^{i\phi}\sin\frac{\theta}{2}\ket{1} \right)
$$

However, $e^{i\gamma}$, regarded as a _global phase_, does not pose observable effects to the measurement obtained with or without its presence [@Glendinning2005]. This is because when a unitary operator, say $U$, operates on $\ket{\psi}$, its $ket$-side remains unchanged whereas its $bra$-side negates it (due to complex conjugation), which effectively eliminates $e^{i\gamma}$ [@UVPhysics2023]:

$$
\braket{e^{i\gamma}\psi|U|e^{i\gamma}\psi} = e^{i\gamma}\cdot e^{-i\gamma}\braket{\psi|U|\psi} = \braket{\psi|U|\psi}
$$

Effectively, the Bloch state function can be simplified to:

$$
\begin{equation}
\ket{\psi} = \cos\frac{\theta}{2}\ket{0} + e^{i\phi}\sin\frac{\theta}{2}\ket{1}
\end{equation}
$$

How did they come about (1)? A curious mind would like to know. The following subsection unravels it!

<div class="admonition note">
<span class="title"><b>Note:</b>Physics Territory</span>
<p>We are delving into some concepts in Physics, such as Spin Angular Momentum. Reader's discretion is advised.</p>
</div>

### Derivation of Bloch Sphere state function

> I will skip some details here for brevity. If you need a more detailed coverage and preliminaries, I recommend taking a look at [@UVPhysics2023;@Zettili2009].

![Spherical representation of an arbitrary position vector in space](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/a8ckag2urb0t9az4hesa.webp)
{Figure 2: Spherical representation of an arbitrary position vector in space.}

Recall that the cartesian coordinates ($x$, $y$, $z$) of a position vector $\overrightarrow{r}$ relate to its polar coordinates ($r$, $\theta$, $\phi$) in the following fashion [@Zettili2009]:

$$
\begin{equation}
\tag{p1}
x = r\sin\theta\cos\phi, \quad y=r\sin\theta\sin\phi, \quad z=r\cos\theta
\end{equation}
$$

Now, for a $unit$ position vector $\hat n$ (shown in the diagram above), these coordinates become:

$$
\begin{equation}
\tag{p2}
x = \sin\theta\cos\phi, \quad y=\sin\theta\sin\phi, \quad z=\cos\theta
\end{equation}
$$

since $r=1$ (hence the word $unit$).

Measuring the angular spin operator $\overrightarrow{S}$ in $\hat n$ direction produces an operator, say $\hat A$ which is:

$$
\begin{equation}
\tag{p3}
\hat A = \overrightarrow{S} \cdot \hat n = S_x\cdot n_x + S_y\cdot n_y + S_z\cdot n_z
\end{equation}
$$

From [@Zettili2009], the Pauli matrice &mdash; $\sigma_x, \sigma_y, \sigma_z$ &mdash; are defined as:

$$
\begin{equation}
\tag{p4}
\sigma_x = \begin{pmatrix} 0 & 1 \\ 1 & 0 \end{pmatrix}, \quad \sigma_y = \begin{pmatrix} 0 & -i \\ i & 0 \end{pmatrix}, \sigma_z = \begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}
\end{equation}
$$

For a spin-$\frac{1}{2}$​ particle, the spin operators are 2x2 matrices which relate to Pauli matrices by $\frac{\hbar}{2}$ so that:

$$
\begin{equation}
\tag{p5}
S_x = \frac{\hbar}{2}\cdot\sigma_x, \quad S_y = \frac{\hbar}{2}\cdot\sigma_y, \quad S_z = \frac{\hbar}{2}\cdot\sigma_z
\end{equation}
$$

where $\hbar$ is the reduced Plank constant equalling $\frac{h}{2\pi}$.

Substituting (p2), (p4) and (p5) into (p3), we have:

$$
\begin{equation}
\notag
\begin{aligned}
\hat A = & \left\{\frac{\hbar}{2}\begin{pmatrix} 0 & 1 \\ 1 & 0 \end{pmatrix}\right\} \sin\theta\cos\phi \\
        &+ \left\{\frac{\hbar}{2}\begin{pmatrix} 0 & -i \\ i & 0 \end{pmatrix}\right\} \sin\theta\sin\phi \\
        &+ \left\{\frac{\hbar}{2}\begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}\right\} \cos\theta
\end{aligned}
\end{equation}
$$

$$
\begin{equation}
\notag
\hat A = \frac{\hbar}{2} \left[
\begin{pmatrix} 0 & \sin\theta\cos\phi \\ \sin\theta\cos\phi & 0 \end{pmatrix}
+ \begin{pmatrix} 0 & -i\sin\theta\sin\phi \\ i\sin\theta\sin\phi & 0 \end{pmatrix}
+ \begin{pmatrix} \cos\theta & 0 \\ 0 & -\cos\theta \end{pmatrix}
\right]
\end{equation}
$$

When the matrices are added, we have:

$$
\begin{equation}
\notag
\begin{aligned}
\hat A &= \frac{\hbar}{2}
\begin{pmatrix}
\cos\theta & \sin\theta\cos\phi - i\sin\theta\sin\phi \\
\sin\theta\cos\phi + i\sin\theta\sin\phi & -\cos\theta
\end{pmatrix} \\
&= \frac{\hbar}{2}
\begin{pmatrix}
\cos\theta & \sin\theta(\cos\phi - i\sin\phi) \\
\sin\theta(\cos\phi + i\sin\phi) & -\cos\theta
\end{pmatrix} \\

&= \frac{\hbar}{2}
\begin{pmatrix}
\cos\theta & e^{-i\phi}\sin\theta \\
e^{i\phi}\sin\theta & -\cos\theta
\end{pmatrix}, \quad \text{Since} \,\, e^{i\phi} = \cos\phi + i\sin\phi
\end{aligned}

\end{equation}
$$

Now, we need to obtain the eigenvector of this since its eigenvalue, $\lambda$, is $\pm\frac{\hbar}{2}$ [@Zettili2009;@UVPhysics2023] (this value remains the same irrespective of direction). To do this, we use the eigenvalue equation [@Zettili2009]:

$$
\hat A \psi_\pm = \lambda\psi_\pm
$$

Since we are trying to obtain values for $\psi_\pm$, the unknown, we are at liberty to choose any symbol to represent it as long as it tallies with the dimension of $\hat A$. So,

$$
\frac{\hbar}{2}
\begin{pmatrix}
\cos\theta & e^{-i\phi}\sin\theta \\
e^{i\phi}\sin\theta & -\cos\theta
\end{pmatrix} \cdot \begin{pmatrix}a\\ b \end{pmatrix} = \frac{\hbar}{2}\begin{pmatrix}a\\ b \end{pmatrix}
$$

$$
\begin{pmatrix}
\cos\theta & e^{-i\phi}\sin\theta \\
e^{i\phi}\sin\theta & -\cos\theta
\end{pmatrix} \cdot \begin{pmatrix}a\\ b \end{pmatrix} = \begin{pmatrix}a\\ b \end{pmatrix}
$$

Multiplying out, we have:

$$
\begin{align}
\tag{p6}
a\cdot\cos\theta + b\cdot e^{-i\phi}\sin\theta &= a\\
\tag{p7}
a\cdot e^{i\phi}\sin\theta - b\cdot\cos\theta &=b
\end{align}
$$

To solve the simultaneous equations, we can express $b$ in terms of $a$ in (p6):

$$
a\cdot\cos\theta + b\cdot e^{-i\phi}\sin\theta = a
$$

$$
\begin{align}
\notag
b &= \frac{a(1-\cos\theta)}{e^{-i\phi}\sin\theta}\\
\notag
&= \frac{a(1-\cos\theta)}{\sin\theta}e^{i\phi}
\end{align}
$$

From [@Wikipedia2025], $1-\cos\theta=2\sin^2\frac{\theta}{2}$ which is the half-angle formula for sine and $\sin\theta=2\sin\frac{\theta}{2}\cos\frac{\theta}{2}$ (sine's double-angle formula). Therefore,

$$
\begin{align}
\notag
b&= \frac{a(2\sin^2\frac{\theta}{2})}{2\sin\frac{\theta}{2}\cos\frac{\theta}{2}}e^{i\phi}\\
\notag
&= \frac{a\cdot\sin\frac{\theta}{2}}{\cos\frac{\theta}{2}}e^{i\phi}
\end{align}
$$

$\therefore$

$$
\psi_\pm = \begin{pmatrix}a\\ \frac{a\cdot\sin\frac{\theta}{2}}{\cos\frac{\theta}{2}}e^{i\phi} \end{pmatrix}
$$

If we eliminate fractions, the recommended practices with eigenvector, we have:

$$
\psi_\pm = \begin{pmatrix}a\cos\frac{\theta}{2}\\ a\cdot\sin\frac{\theta}{2}e^{i\phi} \end{pmatrix}
$$

When we eliminate the common terms, $a$, it becomes:

$$
\psi_\pm = \begin{pmatrix}\cos\frac{\theta}{2}\\ \sin\frac{\theta}{2}e^{i\phi} \end{pmatrix}
$$

Linearly transforming the vector, we have:

$$
\boxed{\psi = \cos\frac{\theta}{2}\ket{0} + e^{i\phi}\sin\frac{\theta}{2}\ket{1}}
$$

which represents the $qubit$ state on the Bloch sphere.

## Worked examples

### Q1:

_Give the set of all values $\theta$ for which the following pairs of states are equivalent:_

- a. $\ket{1}$ _and_ $\frac{1}{\sqrt{2}} \left( \ket{+} + e^{i\theta}\ket{-} \right)$
- b. $\frac{1}{\sqrt{2}} \left( \ket{i} + e^{i\theta}\ket{-i} \right)$ _and_ $\frac{1}{\sqrt{2}} \left( \ket{-i} + e^{-i\theta}\ket{i} \right)$
- c. $\frac{1}{2}\ket{0} - \frac{\sqrt{3}}{2}\ket{1}$ _and_ $e^{i\theta} \left( \frac{1}{2}\ket{0} - \frac{\sqrt{3}}{2}\ket{1} \right)$

#### Solution

(a) Given:

$$
\ket{1}, \quad \quad \frac{1}{\sqrt{2}} \left( \ket{+} + e^{i\theta}\ket{-} \right)
$$

To solve this problem, we need to ensure that both states are in the same measurement basis. The first state is in the computational basis while the second is in Hadamard basis. It will be simpler to have both in the computational basis (or, if you want, Hadamard basis). We will transform the state in the Hadamard basis to computational basis in this solution.

From previous article, we know that:

$$
\ket{+} = \frac{1}{\sqrt{2}} (\ket{0} + \ket{1}), \quad \quad \ket{-} = \frac{1}{\sqrt{2}} (\ket{0} - \ket{1})
$$

Therefore, substitute these into the second state:

$$
\begin{align*}
\frac{1}{\sqrt{2}} (\ket{+} + e^{i\theta}\ket{-}) &=\frac{1}{\sqrt{2}} \left( \frac{1}{\sqrt{2}} (\ket{0} + \ket{1}) + e^{i\theta} \frac{1}{\sqrt{2}} (\ket{0} - \ket{1})\right)\\
&=\frac{1}{2}\ket{0} + \frac{1}{2}\ket{1} + \frac{e^{i\theta}}{2}\ket{0}-\frac{e^{i\theta}}{2}\ket{1}\\
&= \frac{1 + e^{i\theta}}{2} \ket{0} + \frac{1 - e^{i\theta}}{2} \ket{1}
\end{align*}
$$

Now, we can compare both states since we want angles with which they are equivalent:

$$
\ket{1} \equiv \frac{1 + e^{i\theta}}{2} \ket{0} + \frac{1 - e^{i\theta}}{2} \ket{1}
$$

Here, we see that for both states to be equivalent, the coefficient of $\ket{0}$, in the left hand side, must be $0$ and that of $\ket{1}$ must be $1$. So, going by the second option:

$$
\begin{align*}
1 &= \frac{1 - e^{i\theta}}{2}\\
2 &= 1 - e^{i\theta}\\
e^{i\theta} &= 1-2 = -1
\end{align*}
$$

From [Euler's formula][2], $e^{i\theta}=\cos\theta + i\sin\theta$.

$\therefore$

$$
\cos\theta + i\sin\theta = -1
$$

Looking at this equation, we can identify that it's complex where $\cos\theta$ and $-1$ are real while $\sin\theta$ and $0$ are imaginary. An important property of complex numbers is that:

> For two complex numbers to be equal, their real and imaginary parts must be equal.

So,

$$
\cos\theta = -1, \quad \sin\theta = 0
$$

Let's take a look at a sample sine and cosine graph.

![Cosine and Sine graph for various angles](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ph3gum2553ci7jo4kd6y.webp)
{Figure 3: Cosine and Sine graph for various angles plotted together}

We can clearly deduce that:

$$
\cos\theta = -1 \quad \text{when} \quad \theta=\{[-\pi,\pi],[-3\pi,3\pi],[-5\pi,5\pi],...\}
$$

Generally, if $n$ is any integer, then:

$$
\cos\theta = -1 \quad \text{when} \quad \theta=(2n+1)\pi = \pi + 2\pi n
$$

For $\sin$,

$$
\sin\theta = 0 \quad \text{when} \quad \theta=\{[0],[-\pi,\pi],[-2\pi,2\pi],[-3\pi,3\pi],[-4\pi,4\pi],[-5\pi,5\pi]...\}
$$

Generally,

$$
\sin\theta = 0 \quad \text{when} \quad \theta=0+\pi n \,\, \text{or} \,\, \theta=\pi n
$$

To account for both cases, $\pi + 2\pi n$ is chosen as this satisfies $\sin\theta$ too (albeit forfeiting some values). Hence, both states will be equivalent when:

$$
\theta= \pi + 2\pi n
$$

(b) We want to find the values of $\theta$ for which the following pair of states are strictly equal:

$$
\frac{1}{\sqrt{2}} \left( \ket{i} + e^{i\theta}\ket{-i} \right) \quad \text{and} \quad \frac{1}{\sqrt{2}} \left( \ket{-i} + e^{-i\theta}\ket{i} \right)
$$

To do this, we transform both states to the computational basis &mdash; in $\ket{0}$ and $\ket{1}$. We recall that:

$$
\begin{equation}
\tag{1}
\ket{i} = \frac{1}{\sqrt{2}}(\ket{0} + i\ket{1}), \quad\quad
    \ket{-i} = \frac{1}{\sqrt{2}}(\ket{0} - i\ket{1})
\end{equation}
$$

Substituting (1) into the state expressions, we get:

$$
\frac{1}{\sqrt{2}}\left(\ket{i} + e^{i\theta}\ket{-i}\right) = \frac{1}{\sqrt{2}}\left(\frac{1}{\sqrt{2}}(\ket{0} + i\ket{1}) + e^{i\theta}\frac{1}{\sqrt{2}}(\ket{0} - i\ket{1})\right) = \frac{1}{2}\left[(1 + e^{i\theta})\ket{0} + i(1 - e^{i\theta})\ket{1}\right]
$$

$$
\frac{1}{\sqrt{2}}\left(\ket{-i} + e^{-i\theta}\ket{i}\right) = \frac{1}{\sqrt{2}}\left(\frac{1}{\sqrt{2}}(\ket{0} - i\ket{1}) + e^{-i\theta}\frac{1}{\sqrt{2}}(\ket{0} + i\ket{1})\right) = \frac{1}{2}\left[(1 + e^{-i\theta})\ket{0} + i(-1 + e^{-i\theta})\ket{1}\right]
$$

For the two states to be strictly equal, their coefficients in the computational basis must be equal:

$$
\frac{1}{2}\left[(1 + e^{i\theta})\ket{0} + i(1 - e^{i\theta})\ket{1}\right] = \frac{1}{2}\left[(1 + e^{-i\theta})\ket{0} + i(-1 + e^{-i\theta})\ket{1}\right]
$$

Multiplying by 2:

$$
(1 + e^{i\theta})\ket{0} + i(1 - e^{i\theta})\ket{1} = (1 + e^{-i\theta})\ket{0} + i(-1 + e^{-i\theta})\ket{1}
$$

Equating the coefficients of $\ket{0}$:

$$
1 + e^{i\theta} = 1 + e^{-i\theta}
$$

$$
e^{i\theta} = e^{-i\theta}
$$

Using [Euler's formula][2] $e^{ix} = \cos x + i\sin x$:

$$
\begin{align*}
\cos\theta + i\sin\theta &= \cos\theta - i\sin\theta\\
i\sin\theta &= -i\sin\theta\\
2i\sin\theta &= 0\\
\sin\theta &= 0
\end{align*}
$$

From the previous solution, we know that:

$$
\sin\theta = 0 \quad \text{when} \quad \theta=0+\pi n \,\, \text{or} \,\, \theta=\pi n
$$

Now to $\ket{1}$, let's equate its coefficients:

$$
\begin{align*}
i(1 - e^{i\theta}) &= i(-1 + e^{-i\theta})\\
1 - e^{i\theta} &= -1 + e^{-i\theta}\\
1 + 1 &= e^{i\theta} + e^{-i\theta}\\
2 &= e^{i\theta} + e^{-i\theta}\\
2 &= (\cos\theta + i\sin\theta) + (\cos\theta - i\sin\theta) \\
2 &= 2\cos\theta\\
\cos\theta &= 1
\end{align*}
$$

For the two states to be strictly equal, both conditions must be met simultaneously:

$$
\sin\theta = 0 \quad \text{and} \quad \cos\theta = 1
$$

The values of $\theta$ for which $\sin\theta = 0$ are $\theta = n\pi$,
and the values of $\theta$ for which $\cos\theta = 1$ are $\theta = 2\pi n$, where $n$ is an integer ($n \in \mathbb{Z}$).

For both conditions to be true, $\theta$ must be an integer multiple of $2\pi$.

$$
\theta = 2\pi n, \quad \text{where } n \in \mathbb{Z}
$$

If we restrict $n$ to non-negative integers ($K \in \{0, 1, 2, ...\}$), the solution is:

$$
\theta = 2\pi n, \quad \text{where } n \in \mathbb{N}
$$

(c) Given:

$$
\ket{\psi_1} = \frac{1}{2}\ket{0} - \frac{\sqrt{3}}{2}\ket{1}, \quad \ket{\psi_2} = e^{i\theta} \left( \frac{1}{2}\ket{0} - \frac{\sqrt{3}}{2}\ket{1} \right)
$$

Directly, we can deduce that:

$$
\ket{\psi_2} = e^{i\theta}\ket{\psi_1}
$$

This is regarded as _global phase_ equivalence [@Viamontes2007]. This is the case since both states only differ in phase. It means that for all values $\theta$, both states remain the same.

### Q2:

_What are $\theta$ and $\phi$ for each of the states $\ket{+}$, $\ket{-}$, $\ket{i}$, and $\ket{-i}$?_

#### Solution

Before going into specifics, let's lay out some foundations.

We can recall that a single $qubit$ state in the computational basis is of the form:

$$
\ket{\psi} = \alpha\ket{0} + \beta\ket{1}
$$

It has this Bloch sphere state function:

$$
\ket{\psi} = \cos\frac{\theta}{2}\ket{0} + e^{i\phi}\sin\frac{\theta}{2}\ket{1}
$$

Equating both, we have:

$$
\alpha\ket{0} + \beta\ket{1} = \cos\frac{\theta}{2}\ket{0} + e^{i\phi}\sin\frac{\theta}{2}\ket{1}
$$

For both sides to be equal, it means:

$$
\begin{equation}
\tag{f1}
\cos\frac{\theta}{2} = \alpha, \quad \text{and} \quad e^{i\phi}\sin\frac{\theta}{2}=\beta
\end{equation}
$$

where $\theta \in [0, \pi]$ and $\phi \in [0, 2\pi]$.

Now to the specifics.

(i) $\ket{+}$ can be expressed in computational basis as:

$$
\ket{+} = \frac{1}{\sqrt{2}}\ket{0} + \frac{1}{\sqrt{2}}\ket{1}
$$

Here, $\alpha=\beta=\frac{1}{\sqrt{2}}$. Substituting into ($f1$), we have:

$$
\begin{align*}
\cos\frac{\theta}{2} &= \frac{1}{\sqrt{2}}\\
\theta &= 2\cdot\cos^{-1}\left(\frac{1}{\sqrt{2}}\right)\\
\theta &= 2\cdot \frac{\pi}{4}\\
\theta &= \frac{\pi}{2}
\end{align*}
$$

To solve for $\phi$:

$$
\begin{align*}
e^{i\phi}\sin\frac{\theta}{2} &= \frac{1}{\sqrt{2}}\\
(\cos\phi + i\sin\phi)\sin\frac{\frac{\pi}{2}}{2} &= \frac{1}{\sqrt{2}}\\
(\cos\phi + i\sin\phi)\sin\frac{\pi}{4} &= \frac{1}{\sqrt{2}}\\
(\cos\phi + i\sin\phi)\frac{1}{\sqrt{2}} &= \frac{1}{\sqrt{2}}\\
\cos\phi + i\sin\phi &= 1
\end{align*}
$$

We can now equate both real and imaginary parts:

$$
\begin{align*}
\cos\phi = 1 \quad &\text{and} \quad \sin\phi = 0\\
\phi = \cos^{-1}(1) \quad &\text{and} \quad \phi = \sin^{-1}(0)\\
\phi = 0 \quad &\text{and} \quad \phi = 0
\end{align*}
$$

$\therefore$

$\ket{+}$ will be represented on the Bloch sphere with $\theta=\frac{\pi}{2},\phi = 0$.

With this, I will leave those of $\ket{-}$, $\ket{i}$, and $\ket{-i}$ as exercise. It'll be fun!

<div class="admonition note">
<span class="title"><b>Note:</b>Hint</span>

In all, $\theta=\frac{\pi}{2}$ while $\phi$ varies.

</div>

## Outro

Enjoyed this article? I'm a Software Engineer and Technical Writer actively seeking new opportunities to impact and learn, particularly in areas related to web security, finance, healthcare, and education. If you think my expertise aligns with your team's needs, let's chat! You can find me on [LinkedIn](https://www.linkedin.com/in/john-owolabi-idogun/) and [X](https://x.com/Sirneij). I am also an [email](mailto:john@johnowolabiidogun.dev) away.

[1]: https://johnowolabiidogun.dev/blog/quantum-information-processing-foundations-part-1-ab5a3c/6801dc9d6e2495ac3e5db09c#question-2 "Quantum Information Processing: Foundations - Part 1 (Question 2)"
[2]: https://en.wikipedia.org/wiki/Euler%27s_formula "Euler's formula"

References
[@Bloch1946]: Bloch, F. (1946). Nuclear Induction. Physical Review, 70(7-8), 460-474. https://doi.org/10.1103/PhysRev.70.460
[@Rieffel2011]: Rieffel, E. G., & Polak, W. H. (2014). Quantum Computing: A Gentle Introduction. MIT Press. https://books.google.com/books?id=CQ3YoAEACAAJ
[@Glendinning2005]: Glendinning, I. (2005). The Bloch Sphere. Lecture notes at European Centre for Parallel Computing at Vienna. https://web.cecs.pdx.edu/~mperkows/june2007/bloch-sphere.pdf
[@UVPhysics2023]: UV Physics. (2023). Bloch sphere and Qubit Representation. YouTube. https://www.youtube.com/watch?v=nVpj3_NOvRI. Retrieved April 19, 2025
[@Zettili2009]: Zettili, N. (2009). Quantum Mechanics: Concepts and Applications. Wiley.
[@Wikipedia2025]: Wikipedia. (2025). List of trigonometric identities. https://en.wikipedia.org/wiki/List_of_trigonometric_identities. Retrieved April 20, 2025
[@Viamontes2007]: Viamontes, G. F., Markov, I. L., & Hayes, J. P. (2007). Checking equivalence of quantum circuits and states. Proceedings of the 2007 IEEE/ACM International Conference on Computer-Aided Design, 69-74.
