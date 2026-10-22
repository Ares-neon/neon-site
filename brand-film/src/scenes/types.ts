/** Every scene receives its local frame: 0 at the nominal start of the scene,
 * negative during its pre-roll, >= dur during its post-roll. */
export type SceneProps = {f: number};
